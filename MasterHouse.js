const utils = require('./utils')
const { defaultCheck } = utils

function MasterHouseWorker(config) {
  MasterHouseWorker.prototype.updateConfig = (config) => Object.assign(this, { config })
  MasterHouseWorker.prototype.wakeup = function (jobStuff) {
    changeStatus('working')
    runJobFlow.call(this, jobStuff)
  }

  function changeStatus(value) {
    status = value
  }

  /**
   * @function runJobFlow
   * @description pickup job from jobList, and call ending part with all jobs are finished
   * */
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

  /**
   * @function doJob
   * @description check job type and await it until it finished
   * */
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

/**
 * @class MasterHouse
 * @prototype doJobs<function> - accept array with jobs
 * */
function MasterHouse(config = {}) {
  let jobGroupSeq = 0
  let jobSeq = 0

  const jobsGroupMap = {}
  const totalJobs = []
  const totalWorkingJobs = []

  /**
   * @function doJobs
   * @param jobs<array>
   * @description
   * */
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

  function wakeupWorkers(jobsGroupMap) {
    workers.forEach((worker) => worker.wakeup(jobsGroupMap))
  }

  const usingConfig = defaultCheck(new.target, config)
  if (!usingConfig) return null

  const { workerNumber, verbose, callback } = usingConfig
  const workers = [...Array(workerNumber)].map(() => new MasterHouseWorker(usingConfig))

  return this
}
/**
 * @function jobsCreateHelper
 * @descrition help user create function which return promise easier
 * */
MasterHouse.prototype.jobsCreateHelper = function (codes) {
  if (!Array.isArray(codes)) {
    console.error(`[MasterHouse] jobsCreateHelper: codes should be an array.`)
    return
  }
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i]
    if (typeof code !== 'string') {
      console.error(`[MasterHouse] jobsCreateHelper: all codes should be string.`)
      return
    }
  }

  const evalCodes = []
  for (let i = 0; i < codes.length; i++) {
    try {
      evalCodes.push(eval(`() => ${codes[i]}`))
    } catch (e) {
      console.error(
        `[MasterHouse] jobsCreateHelper: codes include invalid codes, please check again. index: ${i}`
      )
    }
  }

  return evalCodes
}

module.exports = MasterHouse
