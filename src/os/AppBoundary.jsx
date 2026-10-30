import { Component } from 'react'

// One broken app must not take the whole desktop down. Each window renders inside its own boundary.
export class AppBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error(`[void-os] ${this.props.name || 'app'} crashed`, error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="os-pad os-stack os-crash" role="alert">
        <p className="os-eyebrow">app stopped</p>
        <p className="os-muted os-small">
          {this.props.name || 'This app'} hit an error. The rest of the desktop is fine.
        </p>
        <div className="os-row">
          <button className="os-btn os-btn-primary" onClick={() => this.setState({ error: null })}>Try again</button>
          {this.props.onClose && (
            <button className="os-btn" onClick={this.props.onClose}>Close window</button>
          )}
        </div>
      </div>
    )
  }
}
