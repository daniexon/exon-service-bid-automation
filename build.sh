#!/bin/bash

set -e
#
tag=${tag:-latest}
service_name=$(basename -s .git `git config --get remote.origin.url`)
dockerhub_org='exonmedia'
# git_branch_s=$(echo ${GIT_BRANCH} | cut -d/ -f2)
s3_target='s3://exon-build-services'

sudo docker build --no-cache \
  -t ${dockerhub_org}/${service_name}:${tag} \
  -t ${dockerhub_org}/${service_name}:${BUILD_NUMBER} .

# -t ${dockerhub_org}/${service_name}:${tag} \
# -t ${dockerhub_org}/${service_name}:${git_branch_s} \

sudo docker push ${dockerhub_org}/${service_name}:${tag}
sudo docker push ${dockerhub_org}/${service_name}:${BUILD_NUMBER}
# sudo docker push ${dockerhub_org}/${service_name}:${git_branch_s}

touch /tmp/${BUILD_NUMBER}

aws s3 cp /tmp/${BUILD_NUMBER} ${s3_target}/svc/${service_name}/
# aws s3 cp /tmp/${BUILD_NUMBER} ${s3_target}/svc/${service_name}/${tag}
# aws s3 cp /tmp/${BUILD_NUMBER} ${s3_target}/svc/${service_name}/${git_branch_s}