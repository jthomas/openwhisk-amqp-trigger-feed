import test from 'ava'
import QueueProcessor from '../../lib/queue_processor.js'

const logger = { error: () => {}, debug: () => {}, info: () => {} }

test('should do set channel pre-fetch value to 1', async t => {
  t.plan(1)

  const queue = 'some-queue-name'
  const channel = {
    prefetch: num => t.is(num, 1),
    checkQueue: async () => {},
    consume: async () => {}
  }
  await QueueProcessor(channel, queue, null, logger)
})

test('should check queue exists before consuming messages', async t => {
  t.plan(2)

  const queue = 'some-queue-name'
  let checked_queue_exists = false

  const channel = {
    checkQueue: (_queue) => {
      t.is(_queue, queue)
      checked_queue_exists = true
    },
    prefetch: () => {},
    consume: async () => {
      t.true(checked_queue_exists)
    }
  }
  await QueueProcessor(channel, queue, null, logger)
})

test('should fire callback for each message & ack after completion', async t => {
  t.plan(5)

  let ack_fired = false
  let callback = null
  const msg = { fields: {}, content: Buffer.from('hello world'), properties: {} }
  const onmessage = async (_msg) => { 
    t.is(_msg, msg)
    t.false(ack_fired)
  }

  const queue = 'some-queue-name'
  const channel = {
    prefetch: () => {},
    checkQueue: async () => {},
    consume: async (_queue, cb) => {
      t.is(_queue, queue)
      callback = cb
    },
    ack: async (_msg) => { 
      t.is(_msg, msg)
      ack_fired = true
    }
  }
  await QueueProcessor(channel, queue, onmessage, logger)
  await callback(msg)

  t.true(ack_fired) 
})

test('should stop listening to messages on cancellation', async t => {
  t.plan(1)

  const consumerTag = 'some-uuid'
  const queue = 'some-queue-name'

  const onmessage = () => t.fail()
  const channel = {
    prefetch: () => {},
    checkQueue: async () => {},
    consume: async () => ({ consumerTag }),
    cancel: async (id) => t.is(id, consumerTag )
  }

  const qp = await QueueProcessor(channel, queue, onmessage, logger)
  await qp.stop()
})

test('should not fire ack and emit error event when onmessage fails', async t => {
  t.plan(1)

  let callback = null
  const msg = { fields: {}, content: Buffer.from('hello world'), properties: {} }
  const err = new Error('failed to fire trigger')
  const onmessage = async () => Promise.reject(err)

  const queue = 'some-queue-name'
  const channel = {
    prefetch: () => {},
    checkQueue: async () => {},
    consume: async (_, cb) => callback = cb
  }
  const qp = await QueueProcessor(channel, queue, onmessage, logger)
  qp.on('error', _err => t.is(_err, err))

  await callback(msg)

  return new Promise(resolve => setTimeout(resolve, 1))
})

test('should throw error if channel.consume fails', async t => {
  t.plan(1)

  const channel = {
    prefetch: () => {},
    checkQueue: async () => {},
    consume: async () => Promise.reject(new Error('Some error message'))
  }
  await t.throwsAsync(() => QueueProcessor(channel, null, null, logger), 'Some error message')
})

test('should throw error if queue does not exist', async t => {
  t.plan(1)

  const channel = {
    prefetch: () => {},
    checkQueue: async () => Promise.reject(new Error('Some error message'))
  }
  await t.throwsAsync(() => QueueProcessor(channel, null, null, logger), 'Some error message')
})

test('should emit error event if channel.ack fails', async t => {
  t.plan(1)

  let callback = null
  const msg = { fields: {}, content: Buffer.from('hello world'), properties: {} }
  const onmessage = async () => {}

  const queue = 'some-queue-name'
  const err = new Error('ack failed')
  const channel = {
    prefetch: () => {},
    checkQueue: async () => {},
    consume: async (_, cb) => callback = cb,
    ack: async () => Promise.reject(err)
  }

  const qp = await QueueProcessor(channel, queue, onmessage, logger)
  qp.on('error', _err => t.is(_err, err))

  await callback(msg)

  return new Promise(resolve => setTimeout(resolve, 1))
})
