import postOffice from '../../data-iframe/postOffice'
import {
  POST_MESSAGE_UPDATE_WALLET,
  POST_MESSAGE_UPDATE_ACCOUNT,
  POST_MESSAGE_UPDATE_ACCOUNT_BALANCE,
  POST_MESSAGE_UPDATE_NETWORK,
  POST_MESSAGE_UPDATE_LOCKS,
  POST_MESSAGE_LOCKED,
  POST_MESSAGE_UNLOCKED,
} from '../../paywall-builder/constants'
import {
  setAccount,
  setAccountBalance,
  setNetwork,
  setLocks,
  setKeys,
  setTransactions,
  getKeys,
  getTransactions,
} from '../../data-iframe/cacheHandler'

describe('data iframe postOffice', () => {
  let fakeWindow
  let fakeTarget

  describe('postOffice', () => {
    function makeWindow() {
      fakeTarget = {
        postMessage: jest.fn(),
      }
      fakeWindow = {
        parent: fakeTarget,
        location: {
          href: 'http://example.com?origin=http%3A%2F%2Ffun.times',
        },
        handlers: {},
        addEventListener(type, handler) {
          fakeWindow.handlers[type] = handler
        },
        storage: {},
        localStorage: {
          getItem: jest.fn(key => fakeWindow.storage[key]),
          setItem: jest.fn((key, value) => {
            if (typeof value !== 'string') {
              throw new Error('localStorage only supports strings')
            }
            fakeWindow.storage[key] = value
          }),
          removeItem: jest.fn(key => {
            delete fakeWindow.storage[key]
          }),
        },
      }
    }
    beforeEach(() => {
      makeWindow()
    })

    it('returns an update listener callback', () => {
      expect.assertions(1)

      const listener = postOffice(fakeWindow, 12)

      expect(listener).toBeInstanceOf(Function)
    })

    describe('update listener', () => {
      let updater
      beforeEach(() => {
        makeWindow()

        updater = postOffice(fakeWindow, 12)
      })

      it('walletModal notifies the main window that a wallet popup is active', done => {
        expect.assertions(1)

        fakeTarget.postMessage = (...args) => {
          expect(args).toEqual([
            {
              type: POST_MESSAGE_UPDATE_WALLET,
              payload: undefined,
            },
            'http://fun.times',
          ])
          done()
        }
        updater('walletModal')
      })

      it('account passes account address to the main window', async done => {
        expect.assertions(1)

        await setAccount(fakeWindow, 'account')

        fakeTarget.postMessage = (...args) => {
          expect(args).toEqual([
            {
              type: POST_MESSAGE_UPDATE_ACCOUNT,
              payload: 'account',
            },
            'http://fun.times',
          ])
          done()
        }
        updater('account')
      })

      it('balance passes account balance to the main window', async done => {
        expect.assertions(1)

        await setAccount(fakeWindow, 'account')
        await setAccountBalance(fakeWindow, '123')

        fakeTarget.postMessage = (...args) => {
          expect(args).toEqual([
            {
              type: POST_MESSAGE_UPDATE_ACCOUNT_BALANCE,
              payload: '123',
            },
            'http://fun.times',
          ])
          done()
        }
        updater('balance')
      })

      it('network passes the network id to the main window', async done => {
        expect.assertions(1)

        await setNetwork(fakeWindow, 2)

        fakeTarget.postMessage = (...args) => {
          expect(args).toEqual([
            {
              type: POST_MESSAGE_UPDATE_NETWORK,
              payload: 2,
            },
            'http://fun.times',
          ])
          done()
        }
        updater('network')
      })

      it('locks passes the lock data to the main window', async done => {
        expect.assertions(1)

        await setAccount(fakeWindow, 'account')
        await setNetwork(fakeWindow, 2)
        await setLocks(fakeWindow, {
          '0x123': {
            address: '0x123',
          },
          '0x456': {
            address: '0x456',
          },
        })
        await setKeys(fakeWindow, {
          '0x123': {
            id: '0x123-account',
            owner: 'account',
            lock: '0x123',
            expiration: 0,
          },
          '0x456': {
            id: '0x456-account',
            owner: 'account',
            lock: '0x456',
            expiration: 0,
          },
        })

        fakeTarget.postMessage = (...args) => {
          if (args[0].type !== POST_MESSAGE_UPDATE_LOCKS) return
          expect(args).toEqual([
            {
              type: POST_MESSAGE_UPDATE_LOCKS,
              payload: {
                '0x123': {
                  address: '0x123',
                  key: {
                    id: '0x123-account',
                    owner: 'account',
                    lock: '0x123',
                    expiration: 0,
                    status: 'none',
                    confirmations: 0,
                    transactions: [],
                  },
                },
                '0x456': {
                  address: '0x456',
                  key: {
                    id: '0x456-account',
                    owner: 'account',
                    lock: '0x456',
                    expiration: 0,
                    status: 'none',
                    confirmations: 0,
                    transactions: [],
                  },
                },
              },
            },
            'http://fun.times',
          ])
          done()
        }

        updater('locks')
      })

      describe('locks', () => {
        async function makeTransaction(
          lock,
          status,
          confirmations,
          hash = 'hash'
        ) {
          const keys = await getKeys(fakeWindow)
          const oldTransactions = await getTransactions(fakeWindow)
          // make this key have a valid timestamp
          keys[lock].expiration = new Date().getTime() / 1000 + 10000
          await setKeys(fakeWindow, keys)
          return setTransactions(fakeWindow, {
            ...oldTransactions,
            [hash]: {
              hash,
              lock,
              key: `${lock}-account`,
              status,
              confirmations,
              blockNumber: 5,
            },
          })
        }
        beforeEach(async () => {
          makeWindow()

          await setAccount(fakeWindow, 'account')
          await setNetwork(fakeWindow, 2)
          await setLocks(fakeWindow, {
            '0x123': {
              address: '0x123',
            },
            '0x456': {
              address: '0x456',
            },
          })
          await setKeys(fakeWindow, {
            '0x123': {
              id: '0x123-account',
              owner: 'account',
              lock: '0x123',
              expiration: 0,
            },
            '0x456': {
              id: '0x456-account',
              owner: 'account',
              lock: '0x456',
              expiration: 0,
            },
          })
          updater = postOffice(fakeWindow, 12)
        })

        it('sends locked if no locks have valid keys', done => {
          expect.assertions(1)

          fakeTarget.postMessage = (...args) => {
            if (args[0].type !== POST_MESSAGE_LOCKED) return
            expect(args).toEqual([
              {
                type: POST_MESSAGE_LOCKED,
                payload: undefined,
              },
              'http://fun.times',
            ])
            done()
          }

          updater('locks')
        })

        it('sends unlocked for keys whose transaction is submitted', async done => {
          expect.assertions(1)

          await makeTransaction('0x123', 'submitted', 0)

          fakeTarget.postMessage = (...args) => {
            if (args[0].type !== POST_MESSAGE_UNLOCKED) return
            expect(args).toEqual([
              {
                type: POST_MESSAGE_UNLOCKED,
                payload: ['0x123'],
              },
              'http://fun.times',
            ])
            done()
          }

          updater('locks')
        })

        it('sends unlocked for keys whose transaction is pending', async done => {
          expect.assertions(1)

          await makeTransaction('0x123', 'pending', 0)

          fakeTarget.postMessage = (...args) => {
            if (args[0].type !== POST_MESSAGE_UNLOCKED) return
            expect(args).toEqual([
              {
                type: POST_MESSAGE_UNLOCKED,
                payload: ['0x123'],
              },
              'http://fun.times',
            ])
            done()
          }

          updater('locks')
        })

        it('sends unlocked for keys whose transaction is confirming', async done => {
          expect.assertions(1)

          await makeTransaction('0x123', 'mined', 1)

          fakeTarget.postMessage = (...args) => {
            if (args[0].type !== POST_MESSAGE_UNLOCKED) return
            expect(args).toEqual([
              {
                type: POST_MESSAGE_UNLOCKED,
                payload: ['0x123'],
              },
              'http://fun.times',
            ])
            done()
          }

          updater('locks')
        })

        it('sends unlocked for keys whose transaction is valid', async done => {
          expect.assertions(1)

          await makeTransaction('0x123', 'mined', 123)

          fakeTarget.postMessage = (...args) => {
            if (args[0].type !== POST_MESSAGE_UNLOCKED) return
            expect(args).toEqual([
              {
                type: POST_MESSAGE_UNLOCKED,
                payload: ['0x123'],
              },
              'http://fun.times',
            ])
            done()
          }

          updater('locks')
        })

        it('sends unlocked with multiple lock addresses if the user has keys on them', async done => {
          expect.assertions(1)

          await makeTransaction('0x123', 'mined', 123)
          await makeTransaction('0x456', 'submitted', 0, 'hash2')

          fakeTarget.postMessage = (...args) => {
            if (args[0].type !== POST_MESSAGE_UNLOCKED) return
            expect(args).toEqual([
              {
                type: POST_MESSAGE_UNLOCKED,
                payload: ['0x123', '0x456'],
              },
              'http://fun.times',
            ])
            done()
          }

          updater('locks')
        })
      })
    })
  })
})
