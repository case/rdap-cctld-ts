import Alpine from 'https://esm.sh/alpinejs@3.14.1'

// Make Alpine available globally for debugging
window.Alpine = Alpine

Alpine.data('app', () => ({
  loading: true,
  data: null,
  error: null,
  expandedManagers: new Set(),
  expandedTlds: new Set(),
  sortColumn: 'tldCount', // Default sort column
  sortDirection: 'desc', // 'asc' or 'desc'
  theme: 'auto', // 'light', 'dark', or 'auto'
  filter: 'all', // 'all', 'gtld', or 'cctld'

  async init() {
    this.loadTheme()
    await this.loadData()
  },

  loadTheme() {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark' || saved === 'auto') {
      this.theme = saved
    }
    this.applyTheme()
  },

  applyTheme() {
    const root = document.documentElement
    root.classList.remove('light', 'dark')

    if (this.theme === 'light') {
      root.classList.add('light')
    } else if (this.theme === 'dark') {
      root.classList.add('dark')
    }
    // If 'auto', don't add any class - let media query handle it
  },

  toggleTheme() {
    // Cycle through: auto -> light -> dark -> auto
    if (this.theme === 'auto') {
      this.theme = 'light'
    } else if (this.theme === 'light') {
      this.theme = 'dark'
    } else {
      this.theme = 'auto'
    }

    localStorage.setItem('theme', this.theme)
    this.applyTheme()
  },

  getThemeIcon() {
    if (this.theme === 'light') {
      return '☀️'
    } else if (this.theme === 'dark') {
      return '🌙'
    } else {
      return '🌓'
    }
  },

  getThemeLabel() {
    if (this.theme === 'light') {
      return 'Light mode'
    } else if (this.theme === 'dark') {
      return 'Dark mode'
    } else {
      return 'Auto (system)'
    }
  },

  async loadData() {
    try {
      const response = await fetch('/api/analysis/tlds')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      this.data = await response.json()
    } catch (err) {
      this.error = err.message
      console.error('Failed to load data:', err)
    } finally {
      this.loading = false
    }
  },

  formatNumber(num) {
    return num.toLocaleString('en-US')
  },

  sortBy(column) {
    // Toggle direction if clicking the same column
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'
    } else {
      this.sortColumn = column
      this.sortDirection = 'desc' // Always start with desc (Z-A / largest first)
    }
  },

  setFilter(filterType) {
    this.filter = filterType
  },

  getFilteredTlds(group) {
    let tlds
    if (this.filter === 'gtld') {
      tlds = group.gTlds || []
    } else if (this.filter === 'cctld') {
      tlds = group.ccTlds || []
    } else {
      tlds = group.tlds || []
    }

    // Convert ASCII IDNs to Unicode using the mapping
    if (this.data?.idnMap) {
      return tlds.map(tld => this.data.idnMap[tld] || tld)
    }
    return tlds
  },

  getSortedManagers() {
    if (!this.data?.managerGrouping?.managerGroups) return []

    let groups = [...this.data.managerGrouping.managerGroups]

    // Apply filter
    if (this.filter === 'gtld') {
      groups = groups.filter(g => g.gTldCount > 0)
    } else if (this.filter === 'cctld') {
      groups = groups.filter(g => g.ccTldCount > 0)
    }

    const column = this.sortColumn
    const direction = this.sortDirection

    groups.sort((a, b) => {
      let aVal, bVal

      switch (column) {
        case 'manager':
          aVal = a.manager.toLowerCase()
          bVal = b.manager.toLowerCase()
          break
        case 'tldCount':
          aVal = a.tldCount
          bVal = b.tldCount
          break
        case 'ccTldCount':
          aVal = a.ccTldCount
          bVal = b.ccTldCount
          break
        case 'gTldCount':
          aVal = a.gTldCount
          bVal = b.gTldCount
          break
        default:
          return 0
      }

      if (aVal < bVal) return direction === 'asc' ? -1 : 1
      if (aVal > bVal) return direction === 'asc' ? 1 : -1
      return 0
    })

    return groups
  },

  getSortIndicator(column) {
    if (this.sortColumn !== column) return ''
    return this.sortDirection === 'asc' ? '▲' : '▼'
  },

  isExpanded(managerId) {
    return this.expandedManagers.has(managerId)
  },

  toggleManager(managerId) {
    if (this.expandedManagers.has(managerId)) {
      this.expandedManagers.delete(managerId)
    } else {
      this.expandedManagers.add(managerId)
    }
    // Force Alpine to re-render
    this.expandedManagers = new Set(this.expandedManagers)
  },

  isTldsExpanded(rowId) {
    return this.expandedTlds.has(rowId)
  },

  toggleTlds(rowId, event) {
    event.stopPropagation()
    if (this.expandedTlds.has(rowId)) {
      this.expandedTlds.delete(rowId)
    } else {
      this.expandedTlds.add(rowId)
    }
    this.expandedTlds = new Set(this.expandedTlds)
  },

  getTldPreview(tlds, maxCount = 5) {
    if (tlds.length <= maxCount) {
      return tlds.join(', ')
    }
    return tlds.slice(0, maxCount).join(', ')
  },

  getTldFull(tlds) {
    return tlds.join(', ')
  },

  hasMoreTlds(tlds, maxCount = 5) {
    return tlds.length > maxCount
  },

  getRemainingCount(tlds, maxCount = 5) {
    return tlds.length - maxCount
  }
}))

Alpine.start()
