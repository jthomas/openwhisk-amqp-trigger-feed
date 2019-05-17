"use strict";

// If URL contains ampqs??
const RabbitMQ = async (amqp, url, options, queue) => {
  const open = await amqp.connect(url, options)
  const chan = await open.createChannel()

  chan.on('error', (err) => {
    console.log('chan.error', err)
    throw err
  })

  chan.on('close', () => {
    console.log('chan.close')
  })

  chan.on('return', msg => {
    console.log('chan.return', msg)
  })

  chan.on('drain', () => {
    console.log('chan.drain')
  })

  await chan.checkQueue(queue)

  return chan
}

module.exports = RabbitMQ
