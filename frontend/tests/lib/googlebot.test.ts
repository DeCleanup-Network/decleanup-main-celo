import {
  claimsGoogleCrawler,
  classifyGoogleCrawler,
  ipv4InCidr,
  ipv6InCidr,
  isPublishedGoogleCrawlerIp,
  isScannerProbePath,
  shouldBlockSpoofedGooglebot,
} from '@/lib/server/googlebot'

const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

describe('Google crawler classification', () => {
  it('detects Googlebot and related crawler tokens', () => {
    expect(claimsGoogleCrawler(GOOGLEBOT_UA)).toBe(true)
    expect(claimsGoogleCrawler('Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) Google-InspectionTool')).toBe(
      true
    )
    expect(claimsGoogleCrawler(BROWSER_UA)).toBe(false)
    expect(claimsGoogleCrawler('curl/8.0')).toBe(false)
  })

  it('does not treat User-Agent as identity', () => {
    expect(classifyGoogleCrawler(GOOGLEBOT_UA, '1.2.3.4')).toBe('spoofed')
    expect(classifyGoogleCrawler(GOOGLEBOT_UA, '66.249.66.1')).toBe('verified')
    expect(classifyGoogleCrawler(BROWSER_UA, '1.2.3.4')).toBe('none')
  })

  it('matches published Googlebot IPv4 and collapsed IPv6 ranges', () => {
    expect(isPublishedGoogleCrawlerIp('66.249.66.1')).toBe(true)
    expect(isPublishedGoogleCrawlerIp('8.8.8.8')).toBe(false)
    expect(isPublishedGoogleCrawlerIp('34.64.82.64')).toBe(true)
    expect(isPublishedGoogleCrawlerIp('2001:4860:4801:10::1')).toBe(true)
    expect(isPublishedGoogleCrawlerIp('2001:db8::1')).toBe(false)
  })
})

describe('CIDR helpers', () => {
  it('matches IPv4 prefixes', () => {
    expect(ipv4InCidr('66.249.66.1', '66.249.66.0/27')).toBe(true)
    expect(ipv4InCidr('66.249.66.40', '66.249.66.0/27')).toBe(false)
  })

  it('matches IPv6 prefixes', () => {
    expect(ipv6InCidr('2001:4860:4801:10::1', '2001:4860:4801::/48')).toBe(true)
    expect(ipv6InCidr('2001:4860:4802::1', '2001:4860:4801::/48')).toBe(false)
  })
})

describe('scanner and write gates', () => {
  it('flags common vulnerability-scanner paths', () => {
    expect(isScannerProbePath('/.env')).toBe(true)
    expect(isScannerProbePath('/.env.local')).toBe(true)
    expect(isScannerProbePath('/.git/config')).toBe(true)
    expect(isScannerProbePath('/wp-admin')).toBe(true)
    expect(isScannerProbePath('/phpmyadmin')).toBe(true)
    expect(isScannerProbePath('/vendor/phpunit/phpunit')).toBe(true)
    expect(isScannerProbePath('/sponsor')).toBe(false)
    expect(isScannerProbePath('/robots.txt')).toBe(false)
    expect(isScannerProbePath('/admin/upload-impact-products')).toBe(false)
  })

  it('blocks spoofed crawlers on writes and sensitive APIs, not public GET pages', () => {
    expect(shouldBlockSpoofedGooglebot('/sponsor', 'GET')).toBe(false)
    expect(shouldBlockSpoofedGooglebot('/', 'GET')).toBe(false)
    expect(shouldBlockSpoofedGooglebot('/sponsor', 'POST')).toBe(true)
    expect(shouldBlockSpoofedGooglebot('/api/passkey/status', 'GET')).toBe(true)
    expect(shouldBlockSpoofedGooglebot('/api/ipfs/upload', 'POST')).toBe(true)
  })
})
