// Key names are validated before any modifiers or focus changes are sent.
const modifiers = ['ControlOrMeta','Control','Alt','Shift','Meta'];
const namedKeys = new Set([
  'Enter','Tab','Escape','Backspace','Delete','Insert','Home','End','PageUp','PageDown',
  'ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','CapsLock','NumLock','ScrollLock',
  'Pause','PrintScreen','ContextMenu','AltGraph','Shift','Control','Alt','Meta',
  'ShiftLeft','ShiftRight','ControlLeft','ControlRight','AltLeft','AltRight','MetaLeft','MetaRight',
  'AudioVolumeMute','AudioVolumeDown','AudioVolumeUp','MediaTrackNext','MediaTrackPrevious','MediaPlayPause',
]);
export function validateKey(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 100 || /[\x00-\x1f\x7f-\x9f]/.test(value)) throw new Error('flow.press requires a supported key or shortcut, such as Enter, Tab or ControlOrMeta+A.');
  let key = value;
  const used = new Set<string>();
  for (;;) {
    const modifier = modifiers.find(item => key.startsWith(item + '+'));
    if (!modifier) break;
    if (used.has(modifier)) throw new Error('A keyboard shortcut must not repeat a modifier.');
    used.add(modifier); key = key.slice(modifier.length + 1);
  }
  if (!namedKeys.has(key) && !/^[\x20-\x7e]$/.test(key) && !/^(?:Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2])|Numpad(?:[0-9]|Add|Subtract|Multiply|Divide|Decimal|Enter)|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash)$/.test(key)) {
    throw new Error('Unsupported keyboard key or shortcut. Use a Playwright key name, such as Enter, ArrowDown or ControlOrMeta+A.');
  }
  return value;
}
