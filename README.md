# Apache OpenWhisk AMQP Event Provider

This is an Apache OpenWhisk trigger feed for an [AMQP](https://www.amqp.org/) provider (e.g. [RabbitMQ](https://www.rabbitmq.com/)). Messages arriving on a queue are fired as trigger events. Messages are processed one at a time, i.e. the next trigger won't be fired until the last message have been processed.

## usage

| Entity                                     | Type | Parameters                            |
| ------------------------------------------ | ---- | ------------------------------------- |
| `/<PROVIDER_NS>/amqp-trigger-feed/changes` | feed | url, queue, format, cert, cert_format |

- `url` is the full AMQP URL for the broker, e.g. `amqp(s)://user:pass@host.name.com:port`
  - *mandatory parameter*
- `queue` is the queue to listen for messages on. **This queue must already exist in the broker.**
  - *mandatory parameter*
- `format` is the format incoming queue messages should be converted before firing as trigger events.
  - valid values: `json`, `utf-8` & `base64`
  - default value: `utf-8`
- `cert` is the PEM server certificate string.
- `cert_format` is the PEM server certificate format
  - valid values: `utf-8` & `base64`.
  - default value: `utf-8`

### cli example

```
wsk trigger create test-amqp-trigger --feed /<PROVIDER_NS>/amqp-trigger-feed/changes --param url <AMQP_URL> --param queue <QUEUE_NAME>
```

### trigger events

Trigger events fired by the provider have a single property (`message`) which contains the queue message.

```
{"message":"<QUEUE_MESSAGE>"}
```

#### message format

AMQP messages are received as native Node.js buffers. Before firing as trigger events this must be converted to a format suitable for encoding in a JSON message. By default the message contents will be converted to a UTF-8 string. The conversion format can be controlled by setting the `format` trigger parameter.

Using `base64` as the format will encoded the raw Buffer as a Base64 string before firing the trigger event. If `json` is used as the format, the buffer is converted to a string and parsed as a JSON object.

### connecting over ssl

If you need to connect to a AMQP broker over TLS, use the `amqp://` URL prefix in the URL parameter.

If the broker uses a self-signed certificate, this will need to be provided in the trigger parameter options. The `cert` parameter is used to provide the certificate value, which can either be the raw certificate string (`-----BEGIN CERTIFICATE-----…`) or a base64-encoded version. If you provide a base-64 encoded version, make sure you specify the `cert_format` parameter to be `base64`.

### errors

If there are any issues with the connection to the broker, the trigger will be automatically disabled. Error details on what has gone wrong are available by retrieving the latest status of the trigger.

```
wsk trigger get test-amqp-trigger
```

## development

### running

See the "[Pluggable OpenWhisk Event Provider](https://github.com/apache/incubator-openwhisk-pluggable-provider)" docs on how to run this event provider. The following environment parameters are needed for this feed provider.

### unit tests

```
npm test
```

### integration tests

- Create a `test/integration/config.json` with the following values.

```
{
  "openwhisk": {
    "apihost": "<OW_HOSTNAME>",
    "api_key": "<OW_KEY>",
    "namespace": "_",
    "trigger": "amqp-trigger-feed-test",
    "rule": "amqp-rule-feed-test"
  },
  "amqp": {
    "url": "<AMQP_BROKER_URL>",
    "queue": "amqp-feed-provider-test"
  }
}
```

- Run the integration tests

```
npm run test-integration
```
