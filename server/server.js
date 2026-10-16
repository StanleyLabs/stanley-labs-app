import { createServer } from "http"
import routes from "./routes.js"
import initSignaling from "./signaling-server.js"

const PORT = process.env.PORT || 3001

const server = createServer(routes)

server.listen(PORT, () => {
	console.log(`HTTP Server listening on port ${PORT}`)
})

initSignaling(server)
