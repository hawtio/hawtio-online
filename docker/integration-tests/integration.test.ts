import './hooks'

describe('njinx-integration', function () {
  test('test1', async () => {
    console.log('test 1')
  })
})

// test('/hello?name=njs', async function () {
//   const resp = await this.client.get('hello?name=njs')
//
//   assert.equal(resp.statusCode, 200)
//   assert.match(resp.body, /Meow, njs!/)
// })
