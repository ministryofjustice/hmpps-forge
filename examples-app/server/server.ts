import './utils/azureAppInsights'

import app from './index'
import { attachForgeDevTools } from './forgeDevTools'
import logger from './logger'

const httpServer = app.listen(app.get('port'), () => {
  logger.info(`Server listening on port ${app.get('port')}`)
})

attachForgeDevTools(httpServer)
