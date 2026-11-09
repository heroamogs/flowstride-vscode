/** Command names mirror the public native runtimes in OS and Cloud. */
export const nativeCommands: Readonly<Record<string, readonly string[]>> = {
  browser: ['create', 'use', 'close', 'list', 'offline', 'permissions', 'clearPermissions', 'geolocation'],
  assert: ['that', 'value'], network: ['route', 'unroute', 'arm', 'wait', 'expect'],
  download: ['arm', 'save', 'expect'],
  clock: ['install', 'pauseAt', 'resume', 'runFor', 'fastForward', 'setFixedTime', 'setSystemTime'],
  stub: ['install', 'expect', 'restore'], trace: ['start', 'stop'], har: ['replay'],
  a11y: ['scan', 'snapshot', 'match'], component: ['mount', 'update', 'unmount'],
  input: ['type'], tab: ['name', 'arm', 'use', 'close'],
  frame: ['use', 'main'], dialog: ['arm', 'expect'],
  files: ['select'], data: ['load', 'cases', 'seed'], file: ['read'],
  cleanup: ['register'],
  api: ['request', 'create', 'use', 'close', 'expectSchema', 'poll'],
  console: ['arm', 'expect'], channel: ['arm', 'expect'], visual: ['capture', 'match'],
};

export const keywordCommands = [
  'acceptDialog', 'autoheal', 'check', 'click', 'close', 'delete', 'drag', 'expect',
  'extract', 'forceClick', 'forceType', 'get', 'graphql', 'hover', 'injectAudio',
  'mail.getotp', 'open', 'passcode', 'patch', 'post', 'put', 'rejectDialog',
  'save', 'select', 'set', 'switchTo', 'try', 'type', 'uncheck', 'upload', 'use',
  'waitForPipeline', 'soft', 'wait', 'log', 'pause', 'pace', 'press', 'clear',
  'focus', 'blur', 'doubleClick', 'rightClick', 'scroll', 'goBack', 'goForward',
  'reload', 'call', 'skipIf',
];

export const nativeMethods = new Set([
  'call', 'skipIf',
  ...Object.entries(nativeCommands).flatMap(([area, actions]) => actions.map(action => `${area}.${action}`)),
]);

export const gameCommands = ['tap', 'drag', 'swipe', 'key', 'checkpoint', 'snapshot', 'expectVisual', 'state', 'expectState', 'snapshotState', 'expectPreserved', 'fixture', 'select'];
