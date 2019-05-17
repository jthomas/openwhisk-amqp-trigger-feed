"use strict";

// What about stopping?
const QueueProcessor = async (channel, queue, onmessage) => {
  channel.prefetch(1)
  // if message is null, channel is closed?
  const consumer = await channel.consume(queue, async msg => {
    try {
      await onmessage(msg)
      // what happens about errors here?
      await channel.ack(msg)
      // should we re-queue?
    } catch (err) {
      throw err
    }
  })

  return () => channel.cancel(consumer)
}

module.exports = QueueProcessor
