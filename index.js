const AMQP = require('./lib/amqp.js')
const QueueProcessor = require('./lib/queue_processor.js')
const Validate = require('./lib/validate.js')
const amqp = require('amqplib')

// - Need to add logging
// - Need to handle errors gracefully
module.exports = function (triggerManager, logger) {
  const triggers = new Map()

  // add integration tests for this!
  const format_message = (message, format = 'utf-8') => {
    if (format === 'json') {
      return JSON.parse(message.toString('utf-8'))
    }

    return message.toString(format)
  }

  const add = async (id, details) => {
    // if the trigger is being updated, reset system state for trigger queue.
    if (triggers.has(id)) {
      remove(id)
    }

    const { url, queue, format, cert } = details

    const channel = await AMQP(amqp, url, { ca: [cert] }, queue)
    const onmessage = msg => { 
      // need to handle null
      return triggerManager.fireTrigger(id, { msg: format_message(msg.content, format) })
    }
    const queue_processor = await QueueProcessor(channel, queue, onmessage)

    triggers.set(id, channel)
  }
  
  const remove = async id => {
    if (!triggers.has(id)) return

    const channel = triggers.get(id)
    await channel.connection.close()

    triggers.delete(id)
  }

  return { add, remove }
}

module.exports.validate = async params => Validate(params, (url, options, queue) => AMQP(amqp, url, options, queue))
