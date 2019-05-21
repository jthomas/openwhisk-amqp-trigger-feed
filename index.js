const QueueProcessor = require('./lib/queue_processor.js')
const Validate = require('./lib/validate.js')
const amqp = require('amqplib')

const open_channel = async (url, options) => {
  const open = await amqp.connect(url, options)
  const channel = await open.createChannel()
  return channel
}

const check_queue = async (url, options, queue) => {
  const channel = await open_channel(url, options)
  channel.on('error', console.error)

  await channel.checkQueue(queue)
}

module.exports = function (triggerManager, logger) {
  const triggers = new Map()

  const format_message = (message, format = 'utf-8') => {
    if (format === 'json') {
      return JSON.parse(message.toString('utf-8'))
    }

    return message.toString(format)
  }

  const add = async (id, details) => {
    logger.debug(`amqp-trigger-feed`, 'add() called', id, details)
    // if the trigger is being updated, reset system state for trigger queue.
    if (triggers.has(id)) {
      remove(id)
    }

    const { url, queue, format, cert } = details

    const channel = await open_channel(url, { ca: [cert] } )

    logger.info(`amqp-trigger-feed`, `opened new connection channel at (${url}) for trigger: ${id}`)

    channel.on('error', (err) => {
      logger.error('amqp-trigger-feed', `queue channel error (${url}) for trigger ${id}`, err)
      triggerManager.disableTrigger(id, null, err.message)
    })

    const onmessage = msg => { 
      const evt = { msg: format_message(msg.content, format) }
      logger.debug(`amqp-trigger-feed`, `firing trigger (${id}) with event:`, evt)
      return triggerManager.fireTrigger(id, evt)
    }

    const queue_processor = await QueueProcessor(channel, queue, onmessage, logger, id)
    logger.info(`amqp-trigger-feed`, `queue processor (${queue}) started for trigger: ${id}`)

    queue_processor.on('error', err => {
      logger.error('amqp-trigger-feed', `error from processing queue messages for trigger ${id}`, err)
      triggerManager.disableTrigger(id, null, err.message)
    })

    triggers.set(id, queue_processor)
  }
  
  const remove = async id => {
    logger.debug(`amqp-trigger-feed`, 'remove() called', id)
    if (!triggers.has(id)) return

    const queue_processor = triggers.get(id)
    await queue_processor.stop()
    await queue_processor.channel.connection.close()

    triggers.delete(id)
  }

  return { add, remove }
}

module.exports.validate = async params => Validate(params, check_queue)
