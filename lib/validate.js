const errors = require('./errors.js')

const FeedParameters = [ 'url', 'queue' ]
const ValidFormats = [ 'json', 'utf-8', 'base64' ]
const ValidCertFormats = [ 'utf-8', 'base64' ]

module.exports = async (params, check_queue) => {
  const valid = {}
  for (let param of FeedParameters) {
    if (!params.hasOwnProperty(param)) {
      throw new Error(`amqp trigger feed: missing ${param} parameter`)
    }
    valid[param] = params[param]
  }

  if (params.hasOwnProperty('format')) {
    if (!ValidFormats.includes(params.format)) {
      throw new Error(`amqp trigger feed: format parameter must be json, utf-8 or base64`)
    }

    valid.format = params.format
  }

  if (params.hasOwnProperty('cert')) {
    const cert_format = params.cert_format || 'utf-8'

    if (!ValidCertFormats.includes(cert_format)) {
      throw new Error(`amqp trigger feed: cert_format parameter must be utf-8 or base64`)
    }
    valid.cert = Buffer.from(params.cert, cert_format).toString('utf-8')
  }

  try {
    await check_queue(valid.url, { ca: [valid.cert] }, valid.queue)
    return valid 
  } catch (err) {
    const message = errors.format(err)
    throw new Error(message)
  }
}
