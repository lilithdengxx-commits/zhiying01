import React from 'react'
import ReactDOM from 'react-dom/client'
import { App as AntApp } from 'antd'
import App from './App'

import 'antd/dist/reset.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <AntApp>
    <App />
  </AntApp>
)
