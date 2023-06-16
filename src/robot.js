const search = require('search')
const Zhdtw = require('./common/zhdtw')
const QuizModel = require('./common/quiz-model')

// AnyProxy 只支持 yield 语法，暂不支持 await
module.exports = {
  * beforeDealHttpsRequest (requestDetail) {
    // console.log(requestDetail.host)
    return requestDetail.host === 'question-zh.hortor.net:443'
  },
  * beforeSendRequest (requestDetail) {
    // 原先采用的是改数据发送，经测试发现会频繁的提示需要重新登录，所以改为只提示答案了
  },
  * beforeSendResponse (requestDetail, responseDetail) {
    const response = responseDetail.response
    let data
    let body
    if (requestDetail.url.indexOf('/question/bat/findQuiz') !== -1) {
      try {
        body = JSON.parse(response.body.toString())
        data = body.data
        // console.log('[response]', response)
      } catch (e) {}
      this._findQuiz = data
      console.log('[题目信息]', JSON.stringify(data))
      // 从题库里找答案
      this._quiz = yield QuizModel.findOne({quiz: this._findQuiz.quiz})
      if (this._quiz) {
        const answer = Zhdtw.transformAnswer(this._quiz, this._findQuiz) - 1
        const option = this._findQuiz.options[answer]
        this._findQuiz.options[answer] = '√ ' + option
        console.log('[题库有答案]', option)
      } else {
        // 题库没有，网上搜索
        try {
          const {result, index} = yield search({
            question: this._findQuiz.quiz,
            options: this._findQuiz.options
          })
          // eslint-disable-next-line no-return-assign
          result.forEach((s, i) => this._findQuiz.options[i] = `${index === i ? '√ ' : ''}[${s}] ${this._findQuiz.options[i]}`)
          console.log('[网上搜答案]', result)
        } catch (e) {
          console.error(e)
        }
      }
      body.data = this._findQuiz
      response.body = JSON.stringify(body)
      return {response}
    } else if (requestDetail.url.indexOf('/question/bat/choose') !== -1) {
      try {
        body = JSON.parse(response.body.toString())
        data = body.data
        // console.log('[response]', response)
      } catch (e) {}
      // 提交完答案，会返回正确答案，如果题库没有，就存起来
      if (!this._quiz) {
        const quizModel = new QuizModel(Object.assign(this._findQuiz, {answer: data.answer}))
        yield quizModel.save()
        console.log('[保存到题库]', JSON.stringify(this._findQuiz), data.answer)
      }
    }
  }
}
