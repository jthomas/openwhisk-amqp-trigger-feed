"use strict";

const EventEmitter = require('events')

const QueueProcessor = async (channel, queue, onmessage, logger, id) => {
  const emitter = new EventEmitter()

  channel.prefetch(1)
  await channel.checkQueue(queue)
  logger.debug(`amqp-trigger-feed`, `set channel prefetch to 1 and checking queue (${queue} => ${id}) exists.`)

  // This callback listens to messages from the queue, fires the trigger events
  // and send message acks. Setting pre-fetch to 1 ensures only one message can
  // be processed at a time.
  logger.debug(`amqp-trigger-feed`, `subscribing to queue (${queue} => ${id}) messages...`)
  const consumer = await channel.consume(queue, async msg => {
    logger.info(`amqp-trigger-feed`, `msg received on queue (${queue} => ${id}).`, msg.fields, msg.properties)
    // if message is null, channel is closed?
    let trigger_fired = false

    // The `onmessage` function fires triggers using the trigger manager interface.
    // If this function throws an error, this indicates an unrecoverable issue. This
    // QueueProcessor instance will shortly be stopped. Once the consumer is closed,
    // the (unacknowledged) message will be released back to the queue.
    try {
      await onmessage(msg)
      logger.debug(`amqp-trigger-feed`, `fired trigger for msg (${msg.fields.deliveryTag}) on queue (${queue} => ${id}).`)
      trigger_fired = true
    } catch (err) {
      logger.error(`amqp-trigger-feed`, `failed to fire trigger for msg (${msg.fields.deliveryTag}) on queue (${queue} => ${id}).`)
      emitter.emit('error', err)
    }

    try {
      // Send acknowledgements only when triggers have been fired.
      // Do not send a `reject()` to re-queue failed messages.
      //
      // Once the trigger firing has failed, there's no way to process further messages.
      // Without an ack() or reject() (and the pre-fetch count is set to 1), the consumer will
      // stop trying to process messages.
      // This is what we want whilst we wait for the Queue Processor to be stopped.
      if (trigger_fired) {
        await channel.ack(msg)
        logger.debug(`amqp-trigger-feed`, `sent ack for message (${msg.fields.deliveryTag}) on queue (${queue} => ${id}).`)
      }
    } catch(err) {
      logger.error(`amqp-trigger-feed`, `failed to send ack for msg (${msg.fields.deliveryTag}) on queue (${queue} => ${id}).`)
      emitter.emit('error', err)
    }
  })

  return { 
    channel,
    on: (evt, cb) => emitter.on(evt, cb),
    stop: () => channel.cancel(consumer.consumerTag)
  }
}

module.exports = QueueProcessor
