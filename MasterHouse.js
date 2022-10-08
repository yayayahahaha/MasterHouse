const utils = require('./utils')
const { defaultCheck } = utils

// TODO 好像要想辦法測測看每個 MasterHouse 的獨立性?

// 用 promise 的話就會變成跟之前很像
// 用 callback 的話在使用上又稍嫌麻煩, 也不知道整段的工作什麼時候結束

function MasterHouse(config = {}) {
  MasterHouse.prototype.addJobs = (jobs) => {
    if (!Array.isArray(jobs)) {
      console.error('[MasterHouse] addJobs: jobs shold be an array.')
      return false
    }

    // closure
    jobs.forEach((rawJob) => {
      let job = rawJob
      // if promise will reject, make the catch first
      if (job instanceof Promise) {
        job = Promise.resolve(job)
          .then((result) => ({ status: 'success', result }))
          .catch((result) => ({ status: 'error', result }))
      }

      const jobInfo = {
        status: 'waiting', // waiting, doing, done
        result: null,
        errorData: [],
        tryTimes: 0,
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
    return new Promise((resolve) => {
      resolveFunc = resolve
    })
  }
  MasterHouse.prototype.stop = () => {
    // TODO 強制全部取消的部分
    status = 'stop'
    workers.forEach((worker) => worker.stop())
  }

  function MasterHouseWorker(config) {
    MasterHouseWorker.prototype.getStatus = () => status
    MasterHouseWorker.prototype.start = function () {
      changeStatus('running')
      runJobFlow(config)
    }
    MasterHouseWorker.prototype.stop = function () {
      changeStatus('stop')
    }
    function changeStatus(value) {
      status = value
    }

    async function runJobFlow(config) {
      const { basicDelay, randomDelay } = config
      const delay = basicDelay + Math.round(Math.random() * randomDelay)

      // delay
      await new Promise((resolve) => setTimeout(resolve, delay))

      const pickIndex = pickRandomly ? Math.floor(workingjJobs.length * Math.random()) : 0
      if (workingjJobs.length === 0) {
        // worker go home.
        return void changeStatus('idle')
      }

      const jobInfo = workingjJobs.splice(pickIndex, 1)[0]
      const result = await doJob({ jobInfo, config })
      jobInfo.result = result
      config.eachCallback(jobInfo)
      finishedjobsCount++
      runJobFlow(config)

      if (finishedjobsCount === totalJobs.length) {
        endingPart(config)
      }
    }

    async function doJob({ jobInfo, config }) {
      const { job } = jobInfo
      const { maxRetry } = config

      jobInfo.status = 'doing'
      jobInfo.tryTimes++
      const result = await _getResult(job)
      if (result.status === 'error') {
        jobInfo.errorData.push(result.result)
        if (jobInfo.tryTimes <= maxRetry) {
          return doJob({ jobInfo, config })
        }
      }
      jobInfo.status = 'done'
      return result

      async function _getResult(job) {
        if (job instanceof Promise) return await job
        else if (typeof job === 'function') return await _isFunction(job)
        else return { status: 'success', result: job }
      }
      async function _isFunction(job) {
        return Promise.resolve(job())
          .then((result) => ({ status: 'success', result }))
          .catch((result) => ({ status: 'error', result }))
      }
    }

    let status = 'stop'

    return this
  }

  function endingPart(config) {
    const { callback, verbose } = config
    const resultList = verbose ? totalJobs : totalJobs.map(({ result }) => result)

    callback(resultList)
    resolveFunc(resultList)
    MasterHouse.prototype.stop()
  }

  const usingConfig = defaultCheck(new.target, config)
  if (!usingConfig) return null

  // stop, runnig, idle
  let status = 'stop'

  const { mute, log, eachCallback, callback, pickRandomly, workerNumber, jobs } = usingConfig

  const workers = [...Array(workerNumber)].map(() => new MasterHouseWorker(usingConfig))
  let finishedjobsCount = 0
  let resolveFunc = (f) => f
  const totalJobs = []
  const workingjJobs = []

  this.addJobs(jobs)

  return this
}

const masterHouse = new MasterHouse({
  maxRetry: 1,
  eachCallback: (f) => f,
  workerNumber: 2,
  callback: (f) => console.log(f),
})
const normalFunc = (f) => 'hello'
const pResolveFunc = () => new Promise((r) => setTimeout(() => r('pResolveFunc'), 100))
const pResolve = new Promise((r) => setTimeout(() => r('pResolve'), 100))
const pRejectFunc = () => new Promise((_, j) => setTimeout(() => j('pRejectFunc'), 100))
const pReject = new Promise((_, j) => setTimeout(() => j('pReject'), 100))
masterHouse.addJobs([
  1,
  'string',
  false,
  null,
  [],
  {},

  pResolveFunc,
  normalFunc,
  pResolve,
  pRejectFunc,
  pReject,
])
masterHouse.start()

module.exports = MasterHouse
