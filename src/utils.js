const equal = require('deep-equal');

function objectDiff(newObject, oldObject) {
  const isObject = (obj) => {
    return (typeof obj === 'object') && !(obj instanceof Array);
  };
  const isEmpty = (obj) => {
    for (var _ in obj) {
      return false;
    }
    return true;
  };
  const diff = {};
  for (let key in oldObject) {
    if (oldObject[key] === newObject[key]) {
      continue;
    }
    if (!newObject[key] || !oldObject[key]) {
      diff[key] = newObject[key];
      continue;
    }
    if (isObject(oldObject[key])) {
      let d = objectDiff(newObject[key], oldObject[key]);
      if (d) {
        diff[key] = d;
      }
    } else {
      if (!equal(newObject[key], oldObject[key])) {
        diff[key] = newObject[key];
      }
    }
  }
  return isEmpty(diff) ? null : diff;
}
exports.objectDiff = objectDiff;

exports.deepCopy = function deepCopy(object) {
  return JSON.parse(JSON.stringify(object));
};

exports.durationString = function durationString(timeInSeconds) {
  let seconds = Math.round(timeInSeconds % 60);
  let minutes = Math.floor(timeInSeconds / 60);
  const hours = Math.floor(minutes / 60);
  minutes -= hours * 60;

  if (hours) {
    minutes = "0" + minutes;
  }
  if (seconds < 10) {
    seconds = "0" + seconds;
  }

  if (hours) {
    return `${hours}:${minutes}:${seconds}`;
  }
  return `${minutes}:${seconds}`;
};
