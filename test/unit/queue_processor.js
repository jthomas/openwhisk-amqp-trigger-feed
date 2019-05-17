import test from 'ava'
import QueueProcessor from '../../lib/queue_processor.js'

test('should do set channel pre-fetch value to 1', async t => {
  t.plan(1)

  const queue = 'some-queue-name'
  const channel = {
    prefetch: num => t.is(num, 1),
    consume: async () => {}
  }
  await QueueProcessor(channel, queue)
})

test('should fire callback for each message & ack after completion', async t => {
  t.plan(5)

  let ack_fired = false
  let callback = null
  const msg = Buffer.from('hello world')
  const onmessage = async (_msg) => { 
    t.is(_msg, msg)
    t.false(ack_fired)
  }

  const queue = 'some-queue-name'
  const channel = {
    prefetch: () => {},
    consume: async (_queue, cb) => {
      t.is(_queue, queue)
      callback = cb
    },
    ack: async (_msg) => { 
      t.is(_msg, msg)
      ack_fired = true
    }
  }
  await QueueProcessor(channel, queue, onmessage)
  await callback(msg)

  t.true(ack_fired) 
})

test('should stop listening to messages on cancellation', async t => {
  t.plan(1)

  const consumer_id = 'some-uuid'
  const queue = 'some-queue-name'

  const onmessage = () => t.fail()
  const channel = {
    prefetch: () => {},
    consume: async () => consumer_id,
    cancel: async (id) => t.is(id, consumer_id)
  }

  const stop = await QueueProcessor(channel, queue, onmessage)
  await stop()
})

test('should not fire ack when callback throw errors', async t => {
  t.plan(1)

  let ack_fired = false
  let callback = null
  const msg = Buffer.from('hello world')
  const onmessage = async () => Promise.reject(new Error())

  const queue = 'some-queue-name'
  const channel = {
    prefetch: () => {},
    consume: async (_, cb) => callback = cb,
    ack: async () => t.fail()
  }
  await QueueProcessor(channel, queue, onmessage)
  await t.throwsAsync(callback)

})
