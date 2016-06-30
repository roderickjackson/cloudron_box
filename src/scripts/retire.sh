#!/bin/bash

set -eu -o pipefail

if [[ ${EUID} -ne 0 ]]; then
    echo "This script should be run as root." > /dev/stderr
    exit 1
fi

readonly BOX_SRC_DIR=/home/yellowtent/box

if [[ $# == 1 && "$1" == "--check" ]]; then
    echo "OK"
    exit 0
fi

echo "Retiring cloudron"

if [[ "${BOX_ENV}" != "cloudron" ]]; then
	exit 0
fi

"${BOX_SRC_DIR}/setup/splashpage.sh" --retire "$1" --data "$2" # show splash

echo "Stopping apps"
systemctl stop docker # stop the apps

echo "Stopping installer"
systemctl stop cloudron-installer # stop the installer

# do this at the end since stopping the box will kill this script as well
echo "Stopping Cloudron Smartserver"
"${BOX_SRC_DIR}/setup/stop.sh"
