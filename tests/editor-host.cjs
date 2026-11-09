const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
exports.run=async()=>{
  const vscode=require('vscode'),root=process.env.FLOWSTRIDE_EDITOR_TEST_DIR;
  assert(root,'Choose an isolated editor test directory');fs.mkdirSync(root,{recursive:true});
  const extension=vscode.extensions.getExtension('flowstride.flowstride-vscode');assert(extension);await extension.activate();
  assert.equal(extension.packageJSON.version,require('../package.json').version);
  const {nativeCommands,gameCommands}=require('../out/language/catalog'),fixtures=require('./fixtures/native-commands.json');
  const {Lexer}=require('../out/language/lexer'),{Parser}=require('../out/language/parser');
  const parse=text=>new Parser(new Lexer(text).tokenise()).parse();
  const wait=async(check,label)=>{for(let i=0;i<100;i++){if(await check())return;await new Promise(r=>setTimeout(r,50));}throw Error('Timed out: '+label)};
  const diagnostics=uri=>vscode.languages.getDiagnostics(uri).filter(d=>d.source==='Flowstride');
  const config=vscode.workspace.getConfiguration('editor',{languageId:'flow'});
  await config.update('formatOnSave',true,vscode.ConfigurationTarget.Global,true);
  await config.update('defaultFormatter','flowstride.flowstride-vscode',vscode.ConfigurationTarget.Global,true);
  await config.update('tabSize',2,vscode.ConfigurationTarget.Global,true);
  const planned=['data.cases','skipIf'];
  const command=(name,data)=>'  flow.'+name+' '+JSON.stringify(data,null,2)+';';
  const commands=Object.entries(fixtures).filter(([name])=>!planned.includes(name)).map(([name,data])=>command(name,data)).join('\n');
  const planning=planned.map(name=>command(name,fixtures[name])).join('\n');
  const source='Feature: User login\'s flow\nScenario: Native support\nTags: editor, smoke\nGiven "Open"\n'+planning+'\n flow.open "/";\nWhen "Configure native commands"\n'+commands+
    '\n flow.wait 250;\n flow.press "Enter" on input "Search";\nAnd "Intermediate assertion"\n flow.soft expect visible "Ready";\nThen "Result"\n flow.expect visible "Ready";\n flow.assert.value {"actual":2,"operator":"equals","expected":2};\n';
  const filename=path.join(root,'native.flow');fs.writeFileSync(filename,source);
  const document=await vscode.workspace.openTextDocument(filename);await vscode.window.showTextDocument(document);
  const edit=new vscode.WorkspaceEdit();edit.insert(document.uri,new vscode.Position(0,0),'   ');await vscode.workspace.applyEdit(edit);
  const before=document.getText();assert(document.isDirty);
  const edits=await vscode.commands.executeCommand('vscode.executeFormatDocumentProvider',document.uri,{tabSize:2,insertSpaces:true});
  console.log(JSON.stringify({language:document.languageId,formatOnSave:vscode.workspace.getConfiguration('editor',document).get('formatOnSave'),formatter:vscode.workspace.getConfiguration('editor',document).get('defaultFormatter'),formatEdits:edits?.length}));
  assert(edits?.length,'Real formatter must return document edits');
  await vscode.commands.executeCommand('workbench.action.files.save');assert(!document.isDirty);
  const saved=fs.readFileSync(filename,'utf8');assert(!saved.includes('{;'));assert.deepEqual(parse(saved),parse(before));
  assert(saved.startsWith('Feature:'));await wait(()=>diagnostics(document.uri).length===0,'valid batch commands and tags');

  const brokenFile=path.join(root,'misplaced-semicolon.flow');fs.writeFileSync(brokenFile,'Feature: Fix\nScenario: Correct JSON\nGiven "Open"\n flow.open "/";\nWhen "Check"\n flow.assert.that {;\n  "selector":"h1",\n  "condition":"visible"\n };\nThen "Result"\n flow.expect visible "Ready";\n');
  const broken=await vscode.workspace.openTextDocument(brokenFile);await vscode.window.showTextDocument(broken);
  await wait(()=>diagnostics(broken.uri).some(d=>d.code==='flowstride.misplacedSemicolon'),'precise malformed JSON diagnostic');
  const diagnostic=diagnostics(broken.uri).find(d=>d.code==='flowstride.misplacedSemicolon');
  const fixes=await vscode.commands.executeCommand('vscode.executeCodeActionProvider',broken.uri,diagnostic.range,vscode.CodeActionKind.QuickFix.value);
  const fix=fixes.find(f=>f.title==='Remove semicolon after JSON opening brace');assert(fix?.edit);assert(await vscode.workspace.applyEdit(fix.edit));await vscode.commands.executeCommand('workbench.action.files.save');assert(!broken.isDirty);
  await wait(()=>diagnostics(broken.uri).length===0,'quick fix removes the JSON error');assert(!broken.getText().includes('{;'));

  const lateFile=path.join(root,'terminal-then.flow');
  fs.writeFileSync(lateFile,saved+'And "Late assertion"\n flow.expect visible "Ready";\n');
  const late=await vscode.workspace.openTextDocument(lateFile);
  await wait(()=>diagnostics(late.uri).some(d=>d.message.includes('Terminal Lock')),'And after Then is diagnosed');
  const fragmentFile=path.join(root,'assertions.flowpart');
  fs.writeFileSync(fragmentFile,'   flow.expect visible "Ready";\nflow.assert.value {"actual":2,"operator":"equals","expected":2};\n');
  const fragment=await vscode.workspace.openTextDocument(fragmentFile);
  assert.equal(fragment.languageId,'flow');
  await vscode.window.showTextDocument(fragment);
  const fragmentEdit=new vscode.WorkspaceEdit();
  fragmentEdit.insert(fragment.uri,new vscode.Position(0,0),' ');
  assert(await vscode.workspace.applyEdit(fragmentEdit));
  const fragmentEdits=await vscode.commands.executeCommand('vscode.executeFormatDocumentProvider',fragment.uri,{tabSize:2,insertSpaces:true});
  assert(fragmentEdits?.length,'A fragment must have its own formatting edits');
  await vscode.commands.executeCommand('workbench.action.files.save');
  assert(!fragment.isDirty);
  assert.equal(fragment.lineAt(0).text,'flow.expect visible "Ready";');
  assert.equal(fragment.lineAt(1).text,'flow.assert.value {"actual":2,"operator":"equals","expected":2};');
  await wait(()=>diagnostics(fragment.uri).length===0,'command-only fragment is valid');

  let groups=0;
  for(const [area,actions]of Object.entries(nativeCommands)){
    const content='Feature: Completion\nScenario: Write\nGiven "Context"\n flow.open "/";\nWhen "Action"\n flow.'+area+'.';
    const file=path.join(root,'completion-'+area+'.flow');fs.writeFileSync(file,content);const doc=await vscode.workspace.openTextDocument(file);
    const line=doc.lineCount-1,result=await vscode.commands.executeCommand('vscode.executeCompletionItemProvider',doc.uri,new vscode.Position(line,doc.lineAt(line).text.length),'.');
    const labels=result.items.map(item=>typeof item.label==='string'?item.label:item.label.label);
    for(const action of actions)assert(labels.includes(action),area+'.'+action);groups++;
  }
  const gameFile=path.join(root,'game-completion.flow');fs.writeFileSync(gameFile,'Feature: Game\nlet game = "flowstride:game";\nScenario: Write\nGiven "Context"\n flow.open "/";\nWhen "Action"\n game.');
  const gameDoc=await vscode.workspace.openTextDocument(gameFile),line=gameDoc.lineCount-1;
  const result=await vscode.commands.executeCommand('vscode.executeCompletionItemProvider',gameDoc.uri,new vscode.Position(line,gameDoc.lineAt(line).text.length),'.');
  const labels=result.items.map(item=>typeof item.label==='string'?item.label:item.label.label);for(const action of gameCommands)assert(labels.includes(action),action);
  const evidence={status:'passed',extensionVersion:extension.packageJSON.version,vscodeVersion:vscode.version,nativeCommands:Object.keys(fixtures).length,completionGroups:groups,gameCompletions:gameCommands.length,formatOnSave:'passed',possessiveTitle:'passed',quickFix:'passed',terminalThen:'passed',fragmentEditing:'passed'};
  fs.writeFileSync(path.join(root,'host-results.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
};
