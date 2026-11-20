import * as fs from 'node:fs';
import type * as typescript from 'typescript';
import { locateProject } from '../runner';
import { resolveHelperPath } from './shared/helperPath';
import { projectPath } from './shared/projectPath';
import type { DeclarationNode } from './parser';

export function resolveDefinitionFile(flowFile: string, workspace: string, binding: DeclarationNode): string {
  const root = locateProject(flowFile, workspace);
  const configFile = projectPath(root, 'flowstride.config.json');
  let helpersDir: string | undefined;
  if (fs.existsSync(configFile)) {
    if (!fs.statSync(configFile).isFile()) throw new Error('Flowstride configuration must be a file.');
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    if (config?.helpersDir !== undefined && (typeof config.helpersDir !== 'string' || !config.helpersDir.trim())) {
      throw new Error('helpersDir must be a nonempty path.');
    }
    helpersDir = config?.helpersDir;
  }
  return resolveHelperPath(root, flowFile, binding.path, helpersDir);
}

/** Find a static named export without loading or running the workspace module. */
export async function findNamedExport(file: string, text: string, name: string): Promise<{ start: number; end: number } | undefined> {
  const ts = await import('typescript');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  type Node = typescript.Node;
  type Expression = typescript.Expression;
  const location = (node: Node) => ({ start: node.getStart(source), end: node.getEnd() });
  const propertyName = (node: typescript.PropertyName) => ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : undefined;
  const isExported = (statement: typescript.FunctionDeclaration | typescript.VariableStatement) =>
    statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) &&
    !statement.modifiers.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword);
  const declaration = (statement: typescript.Statement, localName: string) => {
    if (ts.isFunctionDeclaration(statement) && statement.body && statement.name?.text === localName) return statement.name;
    if (ts.isVariableStatement(statement)) {
      const variable = statement.declarationList.declarations.find(item => ts.isIdentifier(item.name) && item.name.text === localName);
      return variable?.name;
    }
  };
  const localDefinition = (localName: string) => {
    for (const statement of source.statements) {
      const node = declaration(statement, localName);
      if (node) return node;
    }
  };
  const objectExport = (expression: Expression) => {
    if (!ts.isObjectLiteralExpression(expression)) return;
    const property = expression.properties.find(item => item.name && propertyName(item.name) === name);
    if (property && ts.isShorthandPropertyAssignment(property)) return localDefinition(name) ?? property.name;
    return property?.name;
  };
  const exportAssignment = (left: Expression, right: Expression) => {
    if (left.getText(source) === 'module.exports') return objectExport(right);
    if (!ts.isPropertyAccessExpression(left) && !ts.isElementAccessExpression(left)) return;
    if (!['exports', 'module.exports'].includes(left.expression.getText(source))) return;
    const member = ts.isPropertyAccessExpression(left) ? left.name
      : ts.isStringLiteral(left.argumentExpression) ? left.argumentExpression : undefined;
    if (member?.text === name) {
      return ts.isIdentifier(right) ? localDefinition(right.text) ?? member : member;
    }
  };

  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) || ts.isVariableStatement(statement)) {
      const declared = declaration(statement, name);
      if (declared && isExported(statement)) return location(declared);
    }
    if (ts.isExportDeclaration(statement) && !statement.isTypeOnly && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      const exported = statement.exportClause.elements.find(item => !item.isTypeOnly && item.name.text === name);
      if (exported) {
        const local = statement.moduleSpecifier ? undefined : localDefinition((exported.propertyName ?? exported.name).text);
        return location(local ?? exported.name);
      }
    }
    if (ts.isExportAssignment(statement) && statement.isExportEquals) {
      const exported = objectExport(statement.expression);
      if (exported) return location(exported);
    }
    if (ts.isExpressionStatement(statement) && ts.isBinaryExpression(statement.expression) &&
        statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const exported = exportAssignment(statement.expression.left, statement.expression.right);
      if (exported) return location(exported);
    }
  }
}
