#!/usr/bin/env bats

setup() {
  load "../../node_modules/bats-support/load"
  load "../../node_modules/bats-assert/load"
}

@test "openshift cluster mode (default)" {
  export HAWTIO_ONLINE_MODE=cluster
  run ./config.sh

  assert_success
  assert_openshift_config
  assert_output --partial "mode: 'cluster'"
  refute_output --partial "namespace:"
}

@test "openshift cluster mode (oauth)" {
  export HAWTIO_ONLINE_MODE=cluster
  export HAWTIO_ONLINE_AUTH=oauth
  run ./config.sh

  assert_success
  assert_openshift_config
  assert_output --partial "mode: 'cluster'"
  refute_output --partial "namespace:"
}

@test "k8s cluster mode" {
  export HAWTIO_ONLINE_MODE=cluster
  export HAWTIO_ONLINE_AUTH=form
  run ./config.sh

  assert_success
  assert_form_config
  assert_output --partial "mode: 'cluster'"
  refute_output --partial "namespace:"
}

@test "openshift namespace mode (default)" {
  export HAWTIO_ONLINE_MODE=namespace
  export HAWTIO_ONLINE_NAMESPACE=test
  run ./config.sh

  assert_success
  assert_openshift_config
  assert_output --partial "mode: 'namespace'"
  assert_output --partial "namespace: 'test'"
}

@test "openshift namespace mode (oauth)" {
  export HAWTIO_ONLINE_MODE=namespace
  export HAWTIO_ONLINE_NAMESPACE=test
  export HAWTIO_ONLINE_AUTH=oauth
  run ./config.sh

  assert_success
  assert_openshift_config
  assert_output --partial "mode: 'namespace'"
  assert_output --partial "namespace: 'test'"
}

@test "k8s namespace mode" {
  export HAWTIO_ONLINE_MODE=namespace
  export HAWTIO_ONLINE_NAMESPACE=test
  export HAWTIO_ONLINE_AUTH=form
  run ./config.sh

  assert_success
  assert_form_config
  assert_output --partial "mode: 'namespace'"
  assert_output --partial "namespace: 'test'"
}

assert_openshift_config() {
  assert_line "window.OPENSHIFT_CONFIG = {"
  assert_output --partial "master_uri: new URI().query('').path('/master').toString(),"
  assert_output --partial "hawtio: {"
  assert_output --partial "openshift: {"
  refute_output --partial "form: {"
}

assert_form_config() {
  assert_line "window.OPENSHIFT_CONFIG = window.HAWTIO_OAUTH_CONFIG = {"
  assert_output --partial "master_uri: new URI().query('').path('/master').toString(),"
  assert_output --partial "hawtio: {"
  assert_output --partial "form: {"
  assert_output --partial "uri: new URI().query('').path('/online/login.html').toString()"
  refute_output --partial "openshift: {"
}

@test "fail if HAWTIO_ONLINE_MODE is empty" {
  run ./config.sh

  assert_failure
  assert_line --index 0 "Invalid value for the HAWTIO_ONLINE_MODE environment variable."
  assert_line --index 1 "It should either be 'cluster' or 'namespace', but is not set."
}

@test "fail if HAWTIO_ONLINE_NAMESPACE is empty in namespace mode" {
  export HAWTIO_ONLINE_MODE=namespace
  run ./config.sh

  assert_failure
  assert_output "HAWTIO_ONLINE_NAMESPACE must be set when HAWTIO_ONLINE_MODE=namespace"
}
