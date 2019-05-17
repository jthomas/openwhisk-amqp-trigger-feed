import test from 'ava'
import AMQP from '../../lib/amqp.js'

test('should open connection, create channel and check queue exists', async t => {
  t.plan(3)

  const queue = 'some-queue-name'
  const url = 'some-connection-url'
  const options = { cert: ['some-cert-contents'] }
  const channel = {
    checkQueue: _queue => t.is(_queue, queue),
    on: () => {}
  }

  const amqp = {
    connect: async (_url, _options) => {
      t.is(_url, url)
      t.deepEqual(_options, options)
      return { createChannel: async () => channel }
    }
  }

  await AMQP(amqp, url, options, queue)
})

test('should throw error if channel does not exist', async t => {
  t.plan(2)

  const queue = 'some-queue-name'
  const url = 'some-connection-url'
  const channel = {
    checkQueue: _queue => Promise.reject(new Error('channel does not exist')),
    on: () => {}
  }

  const amqp = {
    connect: async _url => {
      t.is(_url, url)
      return { createChannel: async () => channel }
    }
  }

  return t.throwsAsync(() => AMQP(amqp, url, null, queue))
})
