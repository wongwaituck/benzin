import test from 'ava'
import supertest from 'supertest'
import faker from 'faker'
import { models } from './benzin.json'
import _ from 'lodash'
import e from 'elek'

const capitalize = s => s[0].toUpperCase() + s.slice(1)

let schemas = [],
    Datas = [],
    reqCount = 0

test.afterEach(t => {
  reqCount += t.context.req
})

schemas = _.map(models, (key, model) => {
  return {
    model,
    refs: e(key, 'ref')
  }
})

_.map(schemas.slice(), (s,i) => {
    if (s.refs.map(r => r.relation).indexOf('hasMany') === -1) {
      schemas.splice(i, 1)
      schemas.push(s)
    }
})

const request = supertest('http://localhost:3000')

// variables
let user = {}

test('index', async t => {

  const res = await request.get('/'),
        { status } = res

  t.context.req = 1
  
  t.is(status, 200)

})

test('user sign up', async t => {

  const password = faker.internet.password()
 
  const res = await request
                    .post('/user')
                    .send({
                      username: faker.internet.userName(),
                      password,
                    }),
        { status, body } = res,
        { data } = body

  t.context.req = 1
  
  user = data
  user.password = password

  t.is(status, 200)

})

test('user sign in', async t => {
  
  const res = await request
                    .post('/user/auth')
                    .send({
                      username: user.username,
                      password: user.password
                    }),
        { status, body } = res,
        { data } = body,
        { token } = data
 
  t.context.req = 1
  
  user.token = token

  t.is(status, 200)

})

_.map(schemas, s => {

  let { model } = s,
      Data = {}
  
  model = model.toLowerCase()

  test(`${model} authorization test`, async t => {

    const res = await request
                      .post(`/${model}`)
                      .send({
                        text: faker.lorem.words(5)
                      }),
          { status } = res

    t.context.req = 1

    t.is(status, 401)

  })

  test(`${model} validation test`, async t => {

    const res = await request
                      .post(`/${model}`)
                      .send({
                        text: "************"
                      })
                      .set('Authorization', `Bearer ${user.token}`),
          { status } = res

    t.context.req = 1

    t.is(status, 400)

  })

  test(`${model} save test`, async t => {

    const refs = e(models[capitalize(model)], 'ref')
                 .filter(r => r.ref !== 'User' && r.relation === 'belongsTo')

    let send = {
      text: `tttest${model}`
    }

    _.map(refs, ({ref}) => {

      ref = ref.toLowerCase()
      
      send[`${ref}Id`] = Datas[ref].id

    })

    const res = await request
                      .post(`/${model}`)
                      .send(send)
                      .set('Authorization', `Bearer ${user.token}`),
          { status, body } = res,
          { data } = body

    t.context.req = 1

    Data = data

    Datas[model] = Data

    t.is(status, 200)

  })

  test(`${model} get test`, async t => {

    let req = 0

    const refsBelongsTo = e(models[capitalize(model)], 'ref')
                 .filter(r => r.ref !== 'User' && r.relation === 'belongsTo')

    _.map(refsBelongsTo, async ({ref}) => {

      req++

      ref = ref.toLowerCase()
      
      const res = await request
                        .get(`/${ref}/${Datas[ref].id}`)
                        .set('Authorization', `Bearer ${user.token}`),
            { status, body } = res,
            { data } = body

      t.is(status, 200)

    })
    
    if (refsBelongsTo.length) {

      _.map(refsBelongsTo, async ({ref}) => {

        req++

        ref = ref.toLowerCase()
             
        const res = await request
                        .get(`/${ref}/${Datas[ref].id}/${model}s`)
                        .set('Authorization', `Bearer ${user.token}`),
              { status, body } = res,
              { data } = body

        t.is(status, 200)
        
      })

    }

    const res = await request
                      .get(`/${model}/${Data.id}`)
                      .set('Authorization', `Bearer ${user.token}`),
          { status, body } = res,
          { data } = body

    req++

    t.context.req = req

    Data = data

    t.is(status, 200)

  })

  test(`${model} update test`, async t => {

    const res = await request
                      .put(`/${model}/${Data.id}`)
                      .send({
                        text: `${model}ooooooooooooooo`
                      })
                      .set('Authorization', `Bearer ${user.token}`),
          { status, body } = res,
          { data } = body

    t.context.req = 1

    t.notDeepEqual(data, Data)
    t.is(status, 200)

  })
  
})

test('user relational models', async t => {
   const res = await request
                    .get(`/user/${user.id}`)
                    .set('Authorization', `Bearer ${user.token}`),
        { status, body } = res,
        { data } = body

  t.is(status, 200)
  t.is(data.posts.length, 1)
  t.is(data.comments.length, 1)

  for (let i in models) {
    if(_.filter(e(models[i], 'ref'), {
      ref: 'User',
      relation: 'belongsTo' 
    }).length) {
      
      let name = i

      name = name.toLowerCase()

      const res = await request
                  .get(`/user/${user.id}/${name}s`)
                  .set('Authorization', `Bearer ${user.token}`),
            { status, body } = res,
            { data } = body

      t.is(status, 200)

    }
  }


})

test('delete models', async t => {

  let req = 0

  const datas = []
 
  for (let i in Datas) {
    datas.push({
      name: i,
      id: Datas[i].id
    })
  }

  for (let data of datas ) {

    req++
    
    const res = await request
                      .del(`/${data.name}/${data.id}`)
                      .set('Authorization', `Bearer ${user.token}`),
          { status } = res

    t.is(status, 200)

  }

  t.context.req = req
  
})
