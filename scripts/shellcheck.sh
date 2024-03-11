#!/usr/bin/env bash

excludes=""

target_dirs=(
  "scripts"
  "deploy/openshift/cluster"
  "deploy/script"
  "docker"
  "docker/osconsole"
)

for dir in "${target_dirs[@]}"; do
  echo Linting "$dir/*.sh"
  shellcheck "$dir"/*.sh -e "$excludes"
done
