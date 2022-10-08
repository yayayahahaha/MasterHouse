const utils = require('./utils')
const { defaultCheck } = utils

function MasterHouseWorker(config) {
  return this
}
function MasterHouse(config = {}) {
  const usingConfig = defaultCheck(new.target, config)
  if (!usingConfig) return null

  const {
    mute,
    log,
    basicDelay,
    randomDelay,
    eachCallback,
    callback,
    maxRetry,
    pickRandomly,
    workerNumber,
  } = usingConfig

  const workers = [...Array(workerNumber)].map(() => MasterHouseWorker(usingConfig))

  return this
}
MasterHouse.prototype.start = function () {}
MasterHouse.prototype.addJobs = function (jobs) {
  if (!Array.isArray(jobs)) {
    console.error('[MasterHouse] addJobs: jobs shold be an array.')
    return false
  }
}

new MasterHouse({ basicDelay: -1 })
