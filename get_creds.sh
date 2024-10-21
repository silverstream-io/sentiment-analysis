#!/bin/bash

curl https://d3v-silverstream.zendesk.com/api/v2/apps/1077817/public_key.pem \
  -u cory@silverstream.io/token:rwsE4loTpnHV5OMDu4TCBszVwBpS6XeOKJpqgOG3


curl https://d3v-silverstream.zendesk.com/api/v2/apps/installations.json \
  -u cory@silverstream.io/token:rwsE4loTpnHV5OMDu4TCBszVwBpS6XeOKJpqgOG3 | jq
