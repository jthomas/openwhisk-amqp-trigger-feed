import test from 'ava'

const validate = require('../../lib/validate.js')

test('should return error when missing url parameter', async t => {
  const params = {
    queue: 'some-queue-name'
  }

  await t.throwsAsync(async () => validate(params), {message: 'amqp trigger feed: missing url parameter'});
})

test('should return error when missing queue parameter', async t => {
  const params = {
    url: 'amqp://user:pass@host.name:5672'
  }

  await t.throwsAsync(async () => validate(params), {message: 'amqp trigger feed: missing queue parameter'});
})

test('should return error when format value is invalid', async t => {
  const params = {
    url: 'amqp://user:pass@host.name:5672',
    queue: 'my-queue',
    format: 'something-else'
  }

  await t.throwsAsync(async () => validate(params), {message: 'amqp trigger feed: format parameter must be json, utf-8 or base64'});
})

test('should return error with code or message when accessing bucket fails', async t => {
  const params = {
    url: 'amqp://user:pass@host.name:5672',
    queue: 'some-queue-name'
  }

  const err = new Error('queue error')
  err.code = 404

  const check_queue = async () => Promise.reject(err)

  await t.throwsAsync(async () => validate(params, check_queue), {message: 'amqp trigger feed: error with queue => (code: 404, message: queue error)'});
})

test('should resolve with valid params when accessing bucket succeeds', async t => {
   const params = {
    url: 'amqp://user:pass@host.name:5672',
    queue: 'some-queue-name'
  }

  const check_queue = async () => Promise.resolve()

  const valid_params = await validate(params, check_queue)
  t.deepEqual(params, valid_params)
})

test('should ignore extra params when validating input', async t => {
  const params = {
    queue: 'some-queue-name',
    url: 'amqp://user:pass@host.name:5672'
  }

  const extra_params = Object.assign({ hello: 'world', a: 1 }, params)

  const check_queue = () => Promise.resolve()
  const valid_params = await validate(params, check_queue)
  t.deepEqual(valid_params, params)
})

test('should allow format to be valid values', async t => {
  const params = {
    queue: 'some-queue-name',
    url: 'amqp://user:pass@host.name:5672',
    format: 'json'
  }

  const check_queue = () => Promise.resolve()
  let valid_params = await validate(params, check_queue)
  t.deepEqual(valid_params, params)

  params.format = 'base64'
  valid_params = await validate(params, check_queue)
  t.deepEqual(valid_params, params)

  params.format = 'utf-8'
  valid_params = await validate(params, check_queue)
  t.deepEqual(valid_params, params)
})

test('should allow raw cert to be provided', async t => {
  const cert = '-----BEGIN CERTIFICATE-----\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'lqTCiie89peszqIhCoJQUtBP9oQpcOmTCCaDQ9fkEa122g3VLY7sTwqGG5zrGGGN\n' + 
    '5OdAjKnMQPDNXnaRFFFgsLDAYT8DVoma9AxgkMtD2rja\n' + 
    '-----END CERTIFICATE-----'

  const params = {
    queue: 'some-queue-name',
    url: 'amqp://user:pass@host.name:5672',
    cert
  }

  const check_queue = () => Promise.resolve()
  const valid_params = await validate(params, check_queue)
  t.deepEqual(valid_params, params)
})

test('should allow base64 cert to be provided', async t => {
  const cert = '-----BEGIN CERTIFICATE-----\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'lqTCiie89peszqIhCoJQUtBP9oQpcOmTCCaDQ9fkEa122g3VLY7sTwqGG5zrGGGN\n' + 
    '5OdAjKnMQPDNXnaRFFFgsLDAYT8DVoma9AxgkMtD2rja\n' + 
    '-----END CERTIFICATE-----'

  const params = {
    queue: 'some-queue-name',
    url: 'amqp://user:pass@host.name:5672',
    cert
  }

  const base64_params = {
    queue: 'some-queue-name',
    url: 'amqp://user:pass@host.name:5672',
    cert: Buffer.from(cert).toString('base64'),
    cert_format: 'base64'
  }

  const check_queue = () => Promise.resolve()
  const valid_params = await validate(base64_params, check_queue)
  t.deepEqual(valid_params, params)
})

test('should throw error on invalid cert formats', async t => {
  const cert = '-----BEGIN CERTIFICATE-----\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'lqTCiie89peszqIhCoJQUtBP9oQpcOmTCCaDQ9fkEa122g3VLY7sTwqGG5zrGGGN\n' + 
    '5OdAjKnMQPDNXnaRFFFgsLDAYT8DVoma9AxgkMtD2rja\n' + 
    '-----END CERTIFICATE-----'

  const params = {
    queue: 'some-queue-name',
    url: 'amqp://user:pass@host.name:5672',
    cert: Buffer.from(cert).toString('base64'),
    cert_format: 'json'
  }

  await t.throwsAsync(async () => validate(params), {message: 'amqp trigger feed: cert_format parameter must be utf-8 or base64'});
})
