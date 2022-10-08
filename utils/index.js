const isPositiveInt = (number) => /^[1-9]\d*$/.test(number)

function defaultCheck(newTarget, config) {
  if (newTarget === undefined) {
    console.error('[MasterHouse] Please use new operator to create an instance of MasterHouse')
    return null
  }
  if (Array.isArray(config) || typeof config !== 'object' || !config) {
    console.error('[MasterHouse] config must be an object')
    return null
  }

  const configKeys = Object.keys(config)

  const usingConfig = {}
  const defaultParams = {
    mute: {
      default: false,
      validator: (f) => true,
    },
    log: {
      default: true,
      validator: (f) => true,
    },
    basicDelay: {
      default: 0,
      validator: (value) => value >= 0,
      errorMessage: 'basicDelay can only be equal or bigger than 0',
    },
    randomDelay: {
      default: 0,
      validator: (value) => value >= 0,
      errorMessage: 'randomDelay can only be equal or bigger than 0',
    },
    eachCallback: {
      default: (f) => f,
      validator: (f) => true,
    },
    callback: {
      default: (f) => f,
      validator: (f) => true,
    },
    maxRetry: {
      default: 0,
      validator: (value) => value >= 0,
      errorMessage: 'maxRetry can only be equal or bigger than 0',
    },
    pickRandomly: {
      default: false,
      validator: (f) => true,
    },
    workerNumber: {
      default: 10,
      validator: isPositiveInt,
      errorMessage: 'workerNumber can only be positive integer',
    },
  }

  Object.keys(defaultParams).forEach((key) => {
    const configIndex = configKeys.findIndex((item) => item === key)
    if (~configIndex) configKeys.splice(configIndex, 1)

    const { default: defaultValue, validator, errorMessage = '' } = defaultParams[key]
    const defaultType = typeof defaultValue

    if (config[key] === undefined) {
      usingConfig[key] = defaultValue
      return
    }

    if (typeof config[key] !== defaultType) {
      console.warn(
        `[MasterHouse] typeof config "${key}" can only be ${defaultType}. will use default value: ${defaultValue}`
      )
    } else {
      if (!validator(usingConfig[key])) {
        console.log(`[MasterHouse] ${errorMessage}. will use default value: ${defaultValue}`)
        return
      }

      usingConfig[key] = config[key]
    }
  })

  if (configKeys.length)
    console.warn(`[MasterHouse] there are extra config keys: ${JSON.stringify(configKeys)} `)

  return usingConfig
}

module.exports = { defaultCheck }
