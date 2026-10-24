/** Command names mirror the public native runtimes in OS and Cloud. */
export const nativeCommands: Record<string, readonly string[]> = {
  browser: ['create', 'use', 'close', 'list', 'offline', 'permissions', 'clearPermissions', 'geolocation'],
  assert: ['that'], network: ['route', 'unroute', 'arm', 'wait', 'expect'],
  download: ['arm', 'save', 'expect'],
  clock: ['install', 'pauseAt', 'resume', 'runFor', 'fastForward', 'setFixedTime', 'setSystemTime'],
  stub: ['install', 'expect', 'restore'], trace: ['start', 'stop'], har: ['replay'],
  a11y: ['scan', 'snapshot', 'match'], component: ['mount', 'update', 'unmount'],
};
export const gameCommands = ['tap', 'drag', 'swipe', 'key', 'checkpoint', 'snapshot', 'expectVisual', 'state', 'expectState', 'snapshotState', 'expectPreserved', 'fixture', 'select'];
