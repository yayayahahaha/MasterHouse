const utils = require('./utils')
const { defaultCheck } = utils

function MasterHouse(config = {}) {
  MasterHouse.prototype.addJobs = (jobs) => {
    if (!Array.isArray(jobs)) {
      console.error('[MasterHouse] addJobs: jobs shold be an array.')
      return false
    }

    // closure
    jobs.forEach((job) => {
      const jobInfo = {
        status: 'waiting', // waiting, doing, done
        result: null,
        job,
      }
      totalJobs.push(jobInfo)
      workingjJobs.push(jobInfo)
    })
  }
  MasterHouse.prototype.getTotalJobs = () => totalJobs
  MasterHouse.prototype.getRestJobs = () => totalJobs.filter((job) => job.status !== 'done')
  MasterHouse.prototype.getWorkers = () => workers
  MasterHouse.prototype.start = () => {
    status = 'running'
    workers.forEach((worker) => worker.start())
  }
  MasterHouse.prototype.stop = () => {
    status = 'stop'
    workers.forEach((worker) => worker.stop())
  }

  function MasterHouseWorker(config) {
    MasterHouseWorker.prototype.getStatus = () => status
    MasterHouseWorker.prototype.start = start
    MasterHouseWorker.prototype.stop = stop

    function changeStatus(value) {
      status = value
    }

    async function pickJob({ delay, pickRandomly, eachCallback: callback }) {
      await new Promise((resolve) => setTimeout(resolve, delay))
      const pickIndex = pickRandomly ? Math.floor(workingjJobs.length * Math.random()) : 0

      const jobPiece = workingjJobs.splice(pickIndex, 1)
      if (!jobPiece.length) return void changeStatus('idle')

      const job = jobPiece[0]
      doJob({ job, eachCallback })
    }

    async function doJob({ job: jobInfo, callback }) {
      const { job } = jobInfo
      const result = await _getResult(job)
      console.log(result)

      async function _getResult(job) {
        if (job instanceof Promise) return await _isPromise(job)
        else if (typeof job === 'function') return await _isFunction(job)
        else return job
      }
      function _isPromise(job) {
        return Promise.resolve(job)
          .then((r) => r)
          .catch((e) => e)
      }
      function _isFunction(job) {
        return _isPromise(Promise.resolve(job()))
      }
    }

    const { randomDelay, basicDelay, pickRandomly, eachCallback } = config
    const delay = basicDelay + randomDelay

    let status = 'stop'
    function start() {
      changeStatus('running')
      pickJob({ delay, pickRandomly, eachCallback })
    }
    function stop() {
      changeStatus('stop')
    }

    return this
  }

  const usingConfig = defaultCheck(new.target, config)
  if (!usingConfig) return null

  // stop, runnig, idle
  let status = 'stop'

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
    jobs,
  } = usingConfig

  const workers = [...Array(workerNumber)].map(() => new MasterHouseWorker(usingConfig))
  const totalJobs = []
  const workingjJobs = []
  this.addJobs(jobs)

  return this
}

const masterHouse = new MasterHouse()
const normalFunc = (f) => f
const pResolveFunc = () => new Promise((r) => setTimeout(r, 500))
const pResolve = new Promise((r) => setTimeout(r, 500))
const pRejectFunc = () => new Promise((_, j) => setTimeout(() => j('pRejectFunc'), 500))
const pReject = new Promise((_, j) => setTimeout(() => j('pReject'), 500))
masterHouse.addJobs([
  // 1,
  // 'string',
  // false,
  // null,
  // [],
  // {},
  pResolveFunc,
  normalFunc,
  pResolve,
  pRejectFunc,
  pReject,
])
masterHouse.start()

module.exports = MasterHouse
