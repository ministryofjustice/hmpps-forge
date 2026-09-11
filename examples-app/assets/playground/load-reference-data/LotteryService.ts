/** Simulates the external service that returns a fresh draw on every access. */
export class LotteryService {
  async getLotteryBalls() {
    const available = Array.from({ length: 59 }, (_, index) => index + 1)
    const drawn = Array.from({ length: 7 }, () => {
      const index = Math.floor(Math.random() * available.length)

      return available.splice(index, 1)[0]
    })

    return {
      balls: drawn.slice(0, 6).sort((first, second) => first - second),
      bonusBall: drawn[6],
      drawDate: new Date().toLocaleDateString('en-GB'),
    }
  }
}
