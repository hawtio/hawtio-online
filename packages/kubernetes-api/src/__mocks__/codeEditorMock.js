// eslint-disable-next-line @typescript-eslint/no-var-requires
const React = require('react')

exports.CodeEditor = CodeEditor
exports.Language = {
  json: 'json',
}

function CodeEditor(props) {
  return React.createElement('textarea', {
    defaultValue: props.code,
  })
}
