import axios from 'axios'
import { load as $ } from 'cheerio'
import { Extra } from 'telegraf'
import { bot, command, IBot, state } from 'telegram-bot-framework'

export interface RuyaTabirleriBot extends IBot {}

@bot()
export class RuyaTabirleriBot {
  @state() _messageToEdit?: any
  @state() currentQuery?: string

  @command()
  async * ara() {
    const query = yield {
      input: 'Lütfen aramak istediğiniz kelimeyi girin',
      match: /[a-zA-ZığüöçşİĞÜÖÇŞ][a-zA-ZığüöçşİĞÜÖÇŞ][a-zA-ZığüöçşİĞÜÖÇŞ][a-zA-ZığüöçşİĞÜÖÇŞ]*/,
      matchError: 'Hatalı bir giriş, lütfen en az 3 harf olmak üzere giriş yapın'
    }

    if (!query) {
      yield { message: 'Hatalı giriş, işlem iptal edildi.' }
      return
    }

    let targetUrl = `https://www.ruyatabirleri.com/ara/${query.replace(/\s/g, '+')}`
    try {
      const response = await axios.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1 Safari/605.1.15'
        }
      })

      if (response.status !== 200) {
        yield { message: 'Bir hata oluştu, lütfen daha sonra tekrar deneyin' }
        return
      }

      const { data: page } = response
      let $document = $(page).root()
      let $entries = $document.find('.entery a[title]')
      let entries = $entries.toArray().map((el, index) => {
        const { href, title } = el.attribs
        return [ index + 1, title, href ]
      }) as [ number, string, string ][]

      const selectionStr = yield {
        input: `Lütfen seçim yapın:\n\n${entries.map(it => `${it[ 0 ]}) ${it[ 1 ].trim()}`).join('\n')}`,
        match: /[1-9]\d?/,
        matchError: 'Hatalı giriş yaptınız, lütfen sadece sayı girin',
        retry: 3,
        didMessageSend: (message: any) => this._messageToEdit = message
      }

      if (!selectionStr) {
        yield { message: 'İşlem iptal edildi' }
        if (this._messageToEdit) {
          await this.context.deleteMessage(this._messageToEdit.message_id)
        }

        return
      }

      const selection = parseInt(selectionStr, 10) - 1
      const selectedEntry = entries[ selection ]
      targetUrl = selectedEntry[ 2 ]

      const contentPage = await axios.get(targetUrl)
      if (contentPage.status !== 200) {
        yield { message: 'Bir hata oluştu, lütfen daha sonra tekrar deneyin' }
        return
      }

      $document = $(contentPage.data).root()
      $entries = $document.find('.entery h2,h3,p')
      const items = $entries.toArray()
      const results = {}
      for (let i = 0, limit = items.length; i < limit; i++) {
        const element = items[ i ]
        const $el = $(element).root()

        if (element.tagName.startsWith('h')) {
          const title = $el.text().trim()
          if (/Bize Yaz[ıiIİ]n/i.test(title)) { continue }
          const content = $(items[ ++i ]).root().text().trim()
          results[ title ] = content
        }
        else if (element.attribs.href?.startsWith('#')) {
          break
        }
      }

      const messagesToSend: string[] = []
      let messageLength = 0
      for (const key in results) {
        const value = results[ key ]
        const message = `<strong>${key}</strong>:\n${value}\n\n`
        const length = message.length
        if (messageLength + length > 4096) {
          yield {
            message: messagesToSend.splice(0).join('\n'),
            extra: Extra.HTML(true)
          }

          messageLength = length
        }
        else {
          messageLength += length
        }

        messagesToSend.push(message)
      }

      if (messagesToSend.length) {
        yield {
          message: messagesToSend.splice(0).join('\n'),
          extra: Extra.HTML(true)
        }
      }
    }
    catch (error) {
      console.error(error)
      yield { message: 'Bir hata oluştu, lütfen daha sonra tekrar deneyin' }
    }
  }
}

const app = new RuyaTabirleriBot()
app.start()
