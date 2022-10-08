const utils = require('./utils')
const { defaultCheck } = utils

// TODO 好像要想辦法測測看每個 MasterHouse 的獨立性?

// 用 promise 的話就會變成跟之前很像
// 用 callback 的話在使用上又稍嫌麻煩, 也不知道整段的工作什麼時候結束

function MasterHouseWorker(config) {
  MasterHouseWorker.prototype.updateConfig = (config) => Object.assign(this, { config })
  MasterHouseWorker.prototype.getStatus = () => status
  MasterHouseWorker.prototype.wakeup = function (jobStuff) {
    changeStatus('working')
    runJobFlow.call(this, jobStuff)
  }
  MasterHouseWorker.prototype.stop = function () {
    // TODO 還沒處理強制中斷的
    changeStatus('idel')
  }
  function changeStatus(value) {
    status = value
  }

  async function runJobFlow(jobStuff) {
    // delay
    const { basicDelay, randomDelay } = this.config
    const delay = basicDelay + Math.round(Math.random() * randomDelay)
    await new Promise((resolve) => setTimeout(resolve, delay))

    const { totalWorkingJobs, jobsGroupMap } = jobStuff

    // worker go home.
    if (totalWorkingJobs.length === 0) return void changeStatus('idle')

    const jobInfo = totalWorkingJobs.splice(0, 1)[0]
    const { jobsGroupId, jobId } = jobInfo
    const jobGroup = jobsGroupMap[jobsGroupId]
    const indexInGroup = jobGroup.workingJobs.findIndex((item) => item.jobId === jobId)
    jobGroup.workingJobs.splice(indexInGroup, 1)
    if (jobGroup.status === 'waiting') jobGroup.status = 'doing'

    const result = await doJob.call(this, jobInfo)
    jobInfo.result = result
    jobGroup.finishedJobsCount++
    config.eachCallback(jobInfo)

    runJobFlow.call(this, jobStuff)

    if (jobGroup.finishedJobsCount === jobGroup.totalJobs.length) {
      if (jobGroup.status === 'done') return
      jobGroup.status = 'done'
      jobGroup.finished(jobGroup)
    }
  }

  async function doJob(jobInfo) {
    const { job } = jobInfo
    const { maxRetry } = this.config

    jobInfo.status = 'doing'
    jobInfo.tryTimes++
    const result = await _getResult(job)
    if (result.status === 'error') {
      jobInfo.errorData.push(result.result)
      if (jobInfo.tryTimes <= maxRetry) {
        return doJob.call(this, jobInfo)
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

  let status = 'idle'
  this.config = config

  return this
}

function MasterHouse(config = {}) {
  let jobGroupSeq = 0
  let jobSeq = 0

  const jobsGroupMap = {}
  const totalJobs = []
  const totalWorkingJobs = []

  MasterHouse.prototype.doJobs = (jobs) => {
    if (!Array.isArray(jobs)) {
      console.error('[MasterHouse] doJobs: jobs shold be an array.')
      return false
    }

    const jobsGroupId = `jobsGroup-${++jobGroupSeq}`
    const jobGroup = {
      jobsGroupId,
      status: 'waiting',
      totalJobs: [],
      workingJobs: [],
      finishedJobsCount: 0,
      resolve: null,
    }
    jobsGroupMap[jobsGroupId] = jobGroup

    jobs.forEach((rawJob) => {
      let job = rawJob

      // if promise will reject, make the catch first to avoid uncatch rejection
      if (job instanceof Promise) {
        job = Promise.resolve(job)
          .then((result) => ({ status: 'success', result }))
          .catch((result) => ({ status: 'error', result }))
      }

      const jobId = `job-${jobSeq}`
      jobSeq++
      const jobInfo = {
        jobsGroupId,
        jobId,
        status: 'waiting', // waiting, doing, done
        result: null,
        errorData: [],
        tryTimes: 0,
        job,
      }

      totalJobs.push(jobInfo)
      totalWorkingJobs.push(jobInfo)
      jobGroup.workingJobs.push(jobInfo)
      jobGroup.totalJobs.push(jobInfo)
    })

    return new Promise((resolve) => {
      jobsGroupMap[jobsGroupId].finished = function (jobGroup) {
        if (verbose) {
          callback(jobGroup)
          return resolve(jobGroup)
        }

        const result = jobGroup.totalJobs.map(({ result }) => result)
        callback(result)
        resolve(result)
      }
      wakeupWorkers({ jobsGroupMap, totalWorkingJobs, totalJobs })
    })
  }

  MasterHouse.prototype.getTotalJobs = () => totalJobs
  MasterHouse.prototype.getRestJobs = () => totalJobs.filter((job) => job.status !== 'done')
  MasterHouse.prototype.getWorkers = () => workers
  MasterHouse.prototype.stop = () => {
    // TODO 強制全部取消的部分
    workers.forEach((worker) => worker.stop())
  }

  function wakeupWorkers(jobsGroupMap) {
    workers.forEach((worker) => worker.wakeup(jobsGroupMap))
  }

  const usingConfig = defaultCheck(new.target, config)
  if (!usingConfig) return null

  const { workerNumber, verbose, callback } = usingConfig
  const workers = [...Array(workerNumber)].map(() => new MasterHouseWorker(usingConfig))

  return this
}

const normalFunc = (f) => 'hello'
const pResolveFunc = () => new Promise((r) => setTimeout(() => r('pResolveFunc'), 100))
const pResolve = new Promise((r) => setTimeout(() => r('pResolve'), 100))
const pRejectFunc = () => new Promise((_, j) => setTimeout(() => j('pRejectFunc'), 100))
const pReject = new Promise((_, j) => setTimeout(() => j('pReject'), 100))
const masterHouse = new MasterHouse({
  maxRetry: 1,
  eachCallback: (f) => f,
  workerNumber: 2,
  callback: (f) => console.log(f),
})
masterHouse
  .doJobs([
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
  .then((r) => console.log(r))

module.exports = MasterHouse
