// Centralized logging utilities for Apps Script
// Adjust script property LOG_LEVEL to one of: ERROR, WARN, INFO, DEBUG
var LOG_LEVELS = { ERROR:0, WARN:1, INFO:2, DEBUG:3 };

function _getCurrentLogLevel() {
  var val;
  try {
    val = PropertiesService.getScriptProperties().getProperty('LOG_LEVEL');
  } catch(e) {
    val = null;
  }
  val = (val || 'INFO').toUpperCase();
  return LOG_LEVELS[val] !== undefined ? LOG_LEVELS[val] : LOG_LEVELS.INFO;
}

var _CURRENT_LOG_LEVEL = _getCurrentLogLevel();

function appLog(level, msg, meta) {
  return;
}
