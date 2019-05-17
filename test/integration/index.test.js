"use strict"; 

import test from 'ava'

const AMQPTriggerFeed = require('../../index.js')
const openwhisk = require('openwhisk')
const fs = require('fs')
const amqp = require('amqplib')

const winston = require('winston')

const level = process.env.LOG_LEVEL || 'error'
const consoleLogger = new winston.transports.Console({ format: winston.format.simple() })

const logger = winston.createLogger({
  level, transports: [ consoleLogger ]
});

const config = JSON.parse(fs.readFileSync('./test/integration/config.json', 'utf-8'))

const topLevelConfig = ['amqp', 'openwhisk']

for (let param of topLevelConfig) {
  if (!config[param]) throw new Error(`Missing mandatory configuration parameter: ${param}`)
}

const timeout = async delay => {
  return new Promise(resolve => setTimeout(resolve, delay))
}

const ow = openwhisk(config.openwhisk)

const wait_for_activations = async (name, since, max) => {
  logger.info(`looking for ${max} activations (${name}) since ${since}`)
  let activations = []
  while(activations.length < max) {
    activations = await ow.activations.list({name, since, limit: max})
    logger.info(`activations returned: ${activations.length}`)
    await timeout(1000)
  }

  logger.info('retrieving activation details...')
  const activationObjs = await Promise.all(activations.map(actv => ow.activations.get({name: actv.activationId})))
  const activationEvents = activationObjs.sort(actv => actv.start).map(actv => actv.response.result)

  return activationEvents
}

const parse_options = config => {
  const options = { ca: [config.cert] }

  if (config.cert_format === 'base64') {
    options.ca[0] = Buffer.from(options.ca[0], 'base64').toString('utf-8')
  }

  return options
}

test.before(async t => {
  logger.info('create triggers & rules...')
  await ow.triggers.update({name: config.openwhisk.trigger})
  await ow.rules.update({name: config.openwhisk.rule, action: '/whisk.system/utils/echo', trigger: config.openwhisk.trigger})

  const open = await amqp.connect(config.amqp.url, parse_options(config.amqp))
  const chan = await open.createChannel()

  logger.info('ensuring test queue exists...')
  await chan.assertQueue(config.amqp.queue)

  logger.info('ensuring test queue is empty...')
  await chan.purgeQueue(config.amqp.queue)

  await chan.close()
  await open.close()
}) 

test.after.always(async t => {
  await ow.triggers.delete({name: config.openwhisk.trigger})
  await ow.rules.delete({name: config.openwhisk.rule})

  const open = await amqp.connect(config.amqp.url, parse_options(config.amqp))
  const chan = await open.createChannel()
  await chan.deleteQueue(config.amqp.queue)

  await chan.close()
  await open.close()
})

test.serial('amqp queue with string messages should invoke openwhisk triggers', async t => {
  const triggerManager = {
    fireTrigger: (id, event) => ow.triggers.invoke({name: id, params: event})
  }

  const feedProvider = new AMQPTriggerFeed(triggerManager, logger)

  const trigger = `/_/${config.openwhisk.trigger}`
  const details = Object.assign({}, config.amqp)

  if (details.cert_format === 'base64') {
    details.cert = Buffer.from(details.cert, 'base64').toString('utf-8')
  }

  logger.info(`adding trigger (${trigger}) to feed provider...`)
  await feedProvider.add(trigger, details)

  return new Promise(async (resolve, reject) => {
    try {
      const open = await amqp.connect(config.amqp.url, parse_options(config.amqp))
      const chan = await open.createChannel()

      let now = Date.now()

      const NUMBER_OF_MESSAGES = 10
      const messages = []

      for(let i = 0; i < NUMBER_OF_MESSAGES; i++) {
        const message = `message-${i}`
        messages.push(message)
        logger.info(`sending (${message}) to queue...`)
        const result = await chan.sendToQueue(config.amqp.queue, Buffer.from(message));
        logger.info(`sent (${message}) to queue: ${result}`)
      }

      await chan.close()
      await open.close()

      const activationEvents = await wait_for_activations(config.openwhisk.trigger, now, messages.length)
      t.deepEqual(activationEvents.map(msg => msg.msg), messages)

      await feedProvider.remove(trigger)
      resolve()
    } catch (err) {
      logger.error(err)
      reject(err)
    }
  })
});

test.serial('amqp queue with json messages should invoke openwhisk triggers', async t => {
  const triggerManager = {
    fireTrigger: (id, event) => ow.triggers.invoke({name: id, params: event})
  }

  const feedProvider = new AMQPTriggerFeed(triggerManager, logger)

  const trigger = `/_/${config.openwhisk.trigger}`
  const details = Object.assign({}, config.amqp)

  if (details.cert_format === 'base64') {
    details.cert = Buffer.from(details.cert, 'base64').toString('utf-8')
  }

  details.format = 'json'

  await feedProvider.add(trigger, details)

  return new Promise(async (resolve, reject) => {
    try {
      const open = await amqp.connect(config.amqp.url, parse_options(config.amqp))
      const chan = await open.createChannel()

      let now = Date.now()

      const NUMBER_OF_MESSAGES = 10
      const messages = []

      for(let i = 0; i < NUMBER_OF_MESSAGES; i++) {
        const message = `message-${i}`
        messages.push({ message })
        logger.info(`sending (${JSON.stringify({message})}) to queue...`)
        const result = await chan.sendToQueue(config.amqp.queue, Buffer.from(JSON.stringify({ message })));
        logger.info(`sent (${message}) to queue: ${result}`)
      }

      await chan.close()
      await open.close()

      const activationEvents = await wait_for_activations(config.openwhisk.trigger, now, messages.length)
      t.deepEqual(activationEvents.map(msg => msg.msg), messages)

      await feedProvider.remove(trigger)
      resolve()
    } catch (err) {
      logger.error(err)
      reject(err)
    }
  })
});

test.serial('amqp queue with base64 messages should invoke openwhisk triggers', async t => {
  const triggerManager = {
    fireTrigger: (id, event) => ow.triggers.invoke({name: id, params: event})
  }

  const feedProvider = new AMQPTriggerFeed(triggerManager, logger)

  const trigger = `/_/${config.openwhisk.trigger}`
  const details = Object.assign({}, config.amqp)

  if (details.cert_format === 'base64') {
    details.cert = Buffer.from(details.cert, 'base64').toString('utf-8')
  }

  details.format = 'base64'

  await feedProvider.add(trigger, details)

  return new Promise(async (resolve, reject) => {
    try {
      const open = await amqp.connect(config.amqp.url, parse_options(config.amqp))
      const chan = await open.createChannel()

      let now = Date.now()

      const NUMBER_OF_MESSAGES = 10
      const messages = []

      for(let i = 0; i < NUMBER_OF_MESSAGES; i++) {
        const message = Buffer.from(`message-${i}`)
        messages.push(message.toString('base64'))
        logger.info(`sending (${message}) to queue...`)
        const result = await chan.sendToQueue(config.amqp.queue, message);
        logger.info(`sent (${message}) to queue: ${result}`)
      }

      await chan.close()
      await open.close()

      const activationEvents = await wait_for_activations(config.openwhisk.trigger, now, messages.length)
      t.deepEqual(activationEvents.map(msg => msg.msg), messages)

      await feedProvider.remove(trigger)
      resolve()
    } catch (err) {
      logger.error(err)
      reject(err)
    }
  })
});
