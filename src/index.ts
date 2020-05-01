import axios from 'axios'
import { load as $ } from 'cheerio'
import { Extra } from 'telegraf'
import { bot, command, IBot, state, hears } from 'telegram-bot-framework'
import { encode as urlencode } from 'urlencode'

export interface RuyaTabirleriBot extends IBot {}

@bot()
export class RuyaTabirleriBot {
  @state() _messageToEdit?: any
  @state() currentQuery?: string
  @state() lastQueryTime?: number
  @state() newRequestTimerId?: number

  @command({ name: 'baslat' })
  *start() {
    yield "Botu kullanmaya başlamak için lütfen /ara komutuna kullanin veya bir iki kelime ile ne gördüğünüzü yazın.\nYardım için /help komutunu kullanın"
  }

  @command({ name: 'yardim' })
  *help() {
    let message = "Rüya tabirleri botu, gördüğünüz rüyaları /ara manıza olanak"
    message += " sağlayan veya direkt olarak ona yazacağınız bir iki kelime"
    message += " ile tabirleri sizin için bulan bir bottur.\n"
    message += "- Eğer bir /ara ma yaparsanız, size seçenekler sunulur ve bu"
    message += " seçeneklerden ilgili olanın numarasını yazarak detaylı bir"
    message += " tabir size cevap olarak verilir.\n"
    message += "- Eğer mesaj olarak 'rüyamda ... gördüm' veya '... gördüm'"
    message += " gibi bir ifade yazacak olursanız, hızlı bir arama yapılacak"
    message += " ve bulunan ilk sonuç size verilecektir. Bu sonuç eğer sizin"
    message += " istediğiniz gibi çalışmıyorsa, /ara komutunu kullanmayı"
    message += " deneyin.\n"
    message += "Bota destek vermek isterseniz, Bitcoin ve Ether adreslerimiz"
    message += " sırasıyla aşağıdadır:\n"
    yield message

    yield '153jv3MQVNSvyi2i9UFr9L4ogFyJh2SNt6'
    yield '0xf542BED91d0218D9c195286e660da2275EF8eC84'
  }

  async * doSearch(query: string, getFirst = false) {
    if (!query) {
      yield { message: 'Hatalı giriş, işlem iptal edildi.' }
      return
    }

    let targetUrl = `https://www.ruyatabirleri.com/ara/${urlencode(query.replace(/\s/g, '+'))}`
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

      if (entries.length === 0) {
        yield 'Sonuç bulunamadı.'
        return
      }

      let selection:number
      if (!getFirst) {
        let regex = '[1-'
        if (entries.length < 10) {
          regex += `${entries.length}]`
        }
        else {
          regex += `9][0-${entries.length % 10}]?`
        }

        const selectionStr = yield {
          input: `Lütfen seçim yapın:\n\n${entries.map(it => `${it[ 0 ]}) ${it[ 1 ].trim()}`).join('\n')}`,
          match: new RegExp(regex),
          matchError: 'Hatalı giriş yaptınız, lütfen sadece belirtilen seçeneklerden ilgili olanın numarasını girin',
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

        selection = parseInt(selectionStr, 10) - 1
      }
      else {
        selection = 0
      }

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

  @command()
  async * ara() {
    const isWaiting = this.isWaitingForTime()
    if (isWaiting) {
      yield isWaiting
      return
    }

    const query = yield {
      input: 'Lütfen aramak istediğiniz kelimeyi girin',
      match: /[a-zA-ZığüöçşİĞÜÖÇŞ\s][a-zA-ZığüöçşİĞÜÖÇŞ\s][a-zA-ZığüöçşİĞÜÖÇŞ\s][a-zA-ZığüöçşİĞÜÖÇŞ\s]*/,
      matchError: 'Hatalı bir giriş, lütfen en az 3 harf olmak üzere giriş yapın'
    }

    yield* this.doSearch(query, false)
  }

  @hears({ match: /(?:r[üuUÜ]yamda\s+)?([a-zA-Z\süöğışçÜÖĞİŞÇ]+)(?:\s+g[öoOÖ]r((d[üuUÜ]m)|mek))/i })
  async * onRequestFromString(query: string) {
    const isWaiting = this.isWaitingForTime()
    if (isWaiting) {
      yield isWaiting
      return
    }

    yield* this.doSearch(query, true)
  }

  private isWaitingForTime() {
    const now = new Date().getTime()
    if (this.lastQueryTime) {
      const diff = now - this.lastQueryTime!
      console.log('Difference was', diff);

      if (diff < 60000) {
        const message = `Aramalar en fazla 1 dakika aralıklarla mümkündür. Kalan süre ${(60 - (diff / 1000)).toPrecision(2)} saniye`

        if (!this.newRequestTimerId) {
          this.newRequestTimerId = setTimeout(() => {
            this.message$('Şimdi arama yapabilirsiniz!')
            this.newRequestTimerId = undefined
          }, 60000 - diff) as any
        }

        return message
      }
    }

    this.lastQueryTime = now
    return false
  }
}

const app = new RuyaTabirleriBot()
app.run()
