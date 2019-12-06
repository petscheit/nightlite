/*
  Pulled from https://github.com/winstonjs/winston/issues/1427 with some edits.
*/

const { createLogger, format, transports } = require('winston');
const { inspect } = require('util');

function isPrimitive(val) {
  return val === null || (typeof val !== 'object' && typeof val !== 'function');
}

function formatWithInspect(val) {
  const prefix = isPrimitive(val) ? '' : '\n';
  const shouldFormat = typeof val !== 'string';

  return prefix + (shouldFormat ? inspect(val, { depth: null, colors: true }) : val);
}

const logLevel = process.env.NIGHTLITE_LOG_LEVEL ? process.env.NIGHTLITE_LOG_LEVEL : 'info';

module.exports = createLogger({
  level: logLevel,
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.colorize(),
    format.printf(info => {
      const msg = formatWithInspect(info.message);
      const splatArgs = info[Symbol.for('splat')] || [];
      const rest = splatArgs.map(data => formatWithInspect(data)).join(' ');

      return `${info.level}: ${msg} ${rest}`;
    }),
  ),
  transports: [new transports.Console()],
});
