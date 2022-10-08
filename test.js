const MasterHouse = require('./MasterHouse')

async function test() {
  const normalFunc = (f) => 'hello'
  const pResolveFunc = () => new Promise((r) => setTimeout(() => r('pResolveFunc'), 100))
  const pResolve = new Promise((r) => setTimeout(() => r('pResolve'), 100))
  const pRejectFunc = () => new Promise((_, j) => setTimeout(() => j('pRejectFunc'), 100))
  const pReject = new Promise((_, j) => setTimeout(() => j('pReject'), 100))

  const masterHouse = new MasterHouse({
    maxRetry: 1,
    eachCallback: (f) => f,
    workerNumber: 2,
    callback: (f) => console.log('done calback'),
  })

  const result = await masterHouse.doJobs([
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

  console.log('result:', result)
}

test()

module.exports = test
