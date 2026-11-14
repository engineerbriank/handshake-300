#!/usr/bin/env python3
"""Verify Google Play listings and official-site candidates; emit apps.json.
Requires requests. Defaults to the directory containing this script.
"""
import argparse
import concurrent.futures
import datetime
import html
import json
import re
import time
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import requests

# Curated candidate package IDs and believed official websites, not verified claims.
CANDIDATES = {
'finance': '''
com.paypal.android.p2pmobile|https://www.paypal.com
com.venmo|https://venmo.com
com.squareup.cash|https://cash.app
com.robinhood.android|https://robinhood.com
com.coinbase.android|https://www.coinbase.com
com.binance.dev|https://www.binance.com
com.binance.us|https://www.binance.us
com.revolut.revolut|https://www.revolut.com
com.transferwise.android|https://wise.com
com.chase.sig.android|https://www.chase.com
com.infonow.bofa|https://www.bankofamerica.com
com.wf.wellsfargomobile|https://www.wellsfargo.com
com.citi.citimobile|https://www.citi.com
com.konylabs.capitalone|https://www.capitalone.com
com.americanexpress.android.acctsvcs.us|https://www.americanexpress.com
com.discoverfinancial.mobile|https://www.discover.com
com.schwab.mobile|https://www.schwab.com
com.fidelity.android|https://www.fidelity.com
com.webull.trade|https://www.webull.com
com.sofi.mobile|https://www.sofi.com
com.onedebit.chime|https://www.chime.com
com.creditkarma.mobile|https://www.creditkarma.com
com.intuit.turbotax.mobile|https://turbotax.intuit.com
com.youneedabudget.evergreen.app|https://www.ynab.com
com.acorns.android|https://www.acorns.com
''',
'productivity': '''
com.google.android.apps.docs|https://www.google.com/drive/
com.google.android.apps.docs.editors.docs|https://docs.google.com
com.google.android.apps.docs.editors.sheets|https://sheets.google.com
com.google.android.apps.docs.editors.slides|https://slides.google.com
com.google.android.keep|https://keep.google.com
com.google.android.calendar|https://calendar.google.com
com.google.android.apps.tasks|https://tasks.google.com
com.microsoft.office.word|https://www.microsoft.com/microsoft-365/word
com.microsoft.office.excel|https://www.microsoft.com/microsoft-365/excel
com.microsoft.office.powerpoint|https://www.microsoft.com/microsoft-365/powerpoint
com.microsoft.office.onenote|https://www.onenote.com
com.microsoft.skydrive|https://onedrive.live.com
com.dropbox.android|https://www.dropbox.com
notion.id|https://www.notion.com
com.evernote|https://evernote.com
com.todoist|https://todoist.com
com.anydo|https://www.any.do
com.ticktick.task|https://ticktick.com
com.trello|https://trello.com
com.asana.app|https://asana.com
com.microsoft.todos|https://to-do.office.com
com.adobe.reader|https://www.adobe.com/acrobat/pdf-reader.html
cn.wps.moffice_eng|https://www.wps.com
com.intsig.camscanner|https://www.camscanner.com
com.grammarly.android.keyboard|https://www.grammarly.com
''',
'education': '''
com.duolingo|https://www.duolingo.com
org.khanacademy.android|https://www.khanacademy.org
org.khanacademy.kids|https://learn.khanacademy.org/khan-academy-kids/
org.coursera.android|https://www.coursera.org
com.udemy.android|https://www.udemy.com
org.edx.mobile|https://www.edx.org
com.quizlet.quizletandroid|https://quizlet.com
com.memrise.android.memrisecompanion|https://www.memrise.com
com.busuu.android.enc|https://www.busuu.com
com.babbel.mobile.android.en|https://www.babbel.com
com.rosettastone.rs|https://www.rosettastone.com
com.lumoslabs.lumosity|https://www.lumosity.com
com.wonder|https://www.brilliant.org
com.sololearn|https://www.sololearn.com
com.getmimo|https://mimo.org
com.enki.insights|https://www.enki.com
com.google.android.apps.classroom|https://classroom.google.com
com.photomath|https://photomath.com
com.microblink.photomath|https://photomath.com
com.hellochinese|https://www.hellochinese.cc
com.lingodeer|https://www.lingodeer.com
com.elsa.elsa_speak|https://elsaspeak.com
com.kahoot.android|https://kahoot.com
com.linkedin.android.learning|https://www.linkedin.com/learning/
com.blinkslabs.blinkist.android|https://www.blinkist.com
''',
'shopping': '''
com.amazon.mShop.android.shopping|https://www.amazon.com
com.ebay.mobile|https://www.ebay.com
com.walmart.android|https://www.walmart.com
com.target.ui|https://www.target.com
com.etsy.android|https://www.etsy.com
com.contextlogic.wish|https://www.wish.com
com.einnovation.temu|https://www.temu.com
com.zzkko|https://www.shein.com
com.alibaba.aliexpresshd|https://www.aliexpress.com
com.alibaba.intl.android.apps.poseidon|https://www.alibaba.com
com.shopify.arrive|https://shop.app
com.offerup|https://offerup.com
com.poshmark.app|https://poshmark.com
com.mercariapp.mercari|https://www.mercari.com
com.depop|https://www.depop.com
com.vinted|https://www.vinted.com
com.kohls.mcommerce.opal|https://www.kohls.com
com.macys.android|https://www.macys.com
com.nordstrom.app|https://www.nordstrom.com
com.bestbuy.android|https://www.bestbuy.com
com.thehomedepot|https://www.homedepot.com
com.lowes.android|https://www.lowes.com
com.costco.app.android|https://www.costco.com
com.samsclub.app|https://www.samsclub.com
com.instacart.client|https://www.instacart.com
''',
'travel': '''
com.google.android.apps.maps|https://maps.google.com
com.waze|https://www.waze.com
com.ubercab|https://www.uber.com
me.lyft.android|https://www.lyft.com
com.airbnb.android|https://www.airbnb.com
com.booking|https://www.booking.com
com.expedia.bookings|https://www.expedia.com
com.hotels.android|https://www.hotels.com
com.tripadvisor.tripadvisor|https://www.tripadvisor.com
com.kayak.android|https://www.kayak.com
net.skyscanner.android.main|https://www.skyscanner.com
com.hopper.mountainview.play|https://hopper.com
com.vrbo.android|https://www.vrbo.com
com.priceline.android.negotiator|https://www.priceline.com
com.agoda.mobile.consumer|https://www.agoda.com
ctrip.english|https://www.trip.com
com.rome2rio.www.rome2rio|https://www.rome2rio.com
com.tripit|https://www.tripit.com
com.aa.android|https://www.aa.com
com.delta.mobile.android|https://www.delta.com
com.united.mobile.android|https://www.united.com
com.southwestairlines.mobile|https://www.southwest.com
com.aircanada|https://www.aircanada.com
com.turo|https://turo.com
com.getyourguide.android|https://www.getyourguide.com
''',
'communication': '''
com.whatsapp|https://www.whatsapp.com
org.telegram.messenger|https://telegram.org
org.thoughtcrime.securesms|https://signal.org
com.facebook.orca|https://www.messenger.com
com.discord|https://discord.com
com.skype.raider|https://www.skype.com
com.viber.voip|https://www.viber.com
jp.naver.line.android|https://line.me
com.tencent.mm|https://www.wechat.com
com.kakao.talk|https://www.kakaocorp.com
com.google.android.gm|https://mail.google.com
com.microsoft.office.outlook|https://outlook.live.com
com.google.android.apps.messaging|https://messages.google.com
com.google.android.apps.tachyon|https://meet.google.com
com.google.android.apps.googlevoice|https://voice.google.com
us.zoom.videomeetings|https://www.zoom.com
com.Slack|https://slack.com
com.microsoft.teams|https://www.microsoft.com/microsoft-teams/
com.yahoo.mobile.client.android.mail|https://mail.yahoo.com
ch.protonmail.android|https://proton.me/mail
com.fsck.k9|https://k9mail.app
com.textnow.android|https://www.textnow.com
com.imo.android.imoim|https://imo.im
com.zhiliaoapp.musically|https://www.tiktok.com
com.snapchat.android|https://www.snapchat.com
''',
'entertainment': '''
com.spotify.music|https://www.spotify.com
com.netflix.mediaclient|https://www.netflix.com
com.google.android.youtube|https://www.youtube.com
com.google.android.apps.youtube.music|https://music.youtube.com
com.disney.disneyplus|https://www.disneyplus.com
com.hulu.plus|https://www.hulu.com
com.amazon.avod.thirdpartyclient|https://www.primevideo.com
com.wbd.stream|https://www.max.com
com.peacocktv.peacockandroid|https://www.peacocktv.com
com.cbs.app|https://www.paramountplus.com
com.tubitv|https://tubitv.com
com.pluto.tv|https://pluto.tv
com.crunchyroll.crunchyroid|https://www.crunchyroll.com
com.apple.android.music|https://music.apple.com
com.amazon.mp3|https://music.amazon.com
com.pandora.android|https://www.pandora.com
com.soundcloud.android|https://soundcloud.com
com.aspiro.tidal|https://tidal.com
com.deezer.android|https://www.deezer.com
com.audible.application|https://www.audible.com
com.twitch.android.app|https://www.twitch.tv
com.valvesoftware.android.steam.community|https://store.steampowered.com
com.roblox.client|https://www.roblox.com
com.reddit.frontpage|https://www.reddit.com
com.instagram.android|https://www.instagram.com
''',
'health_fitness': '''
com.myfitnesspal.android|https://www.myfitnesspal.com
com.fitbit.FitbitMobile|https://www.fitbit.com
com.strava|https://www.strava.com
com.nike.plusgps|https://www.nike.com/nrc-app
com.nike.ntc|https://www.nike.com/ntc-app
com.garmin.android.apps.connectmobile|https://connect.garmin.com
com.google.android.apps.fitness|https://www.google.com/fit/
com.sec.android.app.shealth|https://www.samsung.com/us/apps/samsung-health/
com.calm.android|https://www.calm.com
com.getsomeheadspace.android|https://www.headspace.com
com.noom.android|https://www.noom.com
com.fitnow.loseit|https://www.loseit.com
com.fitnesskeeper.runkeeper.pro|https://runkeeper.com
com.runtastic.android|https://www.runtastic.com
com.onepeloton.callisto|https://www.onepeloton.com
com.alltrails.alltrails|https://www.alltrails.com
com.northpark.leapfitness|https://leap.app
com.popularapp.periodcalendar|https://www.simpledesign.ltd
org.iggymedia.periodtracker|https://flo.health
com.clue.android|https://helloclue.com
com.urbandroid.sleep|https://sleep.urbandroid.org
com.northcube.sleepcycle|https://www.sleepcycle.com
com.downdogapp|https://www.downdogapp.com
com.dailyyoga.inc|https://www.dailyyoga.com
com.cronometer.android.gold|https://cronometer.com
''',
'business': '''
com.linkedin.android|https://www.linkedin.com
com.indeed.android.jobsearch|https://www.indeed.com
com.glassdoor.app|https://www.glassdoor.com
com.ziprecruiter.android.release|https://www.ziprecruiter.com
com.salesforce.chatter|https://www.salesforce.com
com.hubspot.android|https://www.hubspot.com
com.zoho.crm|https://www.zoho.com/crm/
com.intuit.quickbooks|https://quickbooks.intuit.com
com.squareup|https://squareup.com
com.shopify.mobile|https://www.shopify.com
com.paypal.here|https://www.paypal.com
com.facebook.pages.app|https://www.facebook.com/business/
com.facebook.adsmanager|https://www.facebook.com/business/tools/ads-manager
com.google.android.apps.adwords|https://ads.google.com
com.google.android.apps.giant|https://analytics.google.com
com.adobe.psmobile|https://www.adobe.com/products/photoshop-express.html
com.canva.editor|https://www.canva.com
com.fiverr.fiverr|https://www.fiverr.com
com.upwork.android.apps.main|https://www.upwork.com
com.freelancer.android.messenger|https://www.freelancer.com
com.docusign.ink|https://www.docusign.com
com.microsoft.emmx|https://www.microsoft.com/edge
com.cisco.webex.meetings|https://www.webex.com
com.gotomeeting|https://www.goto.com/meeting
com.ringcentral.android|https://www.ringcentral.com
''',
'technology': '''
com.android.chrome|https://www.google.com/chrome/
org.mozilla.firefox|https://www.mozilla.org/firefox/
com.brave.browser|https://brave.com
com.opera.browser|https://www.opera.com
com.duckduckgo.mobile.android|https://duckduckgo.com
com.github.android|https://github.com/mobile
com.openai.chatgpt|https://chatgpt.com
com.anthropic.claude|https://claude.ai
ai.perplexity.app.android|https://www.perplexity.ai
com.google.android.apps.bard|https://gemini.google.com
com.microsoft.copilot|https://copilot.microsoft.com
com.google.android.apps.authenticator2|https://safety.google/authentication/
com.azure.authenticator|https://www.microsoft.com/security/mobile-authenticator-app
com.authy.authy|https://www.authy.com
com.x8bit.bitwarden|https://bitwarden.com
com.onepassword.android|https://1password.com
com.lastpass.lpandroid|https://www.lastpass.com
com.dashlane|https://www.dashlane.com
com.nordvpn.android|https://nordvpn.com
com.expressvpn.vpn|https://www.expressvpn.com
com.protonvpn.android|https://protonvpn.com
com.cloudflare.onedotonedotonedotone|https://one.one.one.one
org.videolan.vlc|https://www.videolan.org
com.ookla.speedtest|https://www.speedtest.net
com.google.android.apps.nbu.files|https://files.google.com
'''
}
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

class ListingParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.og_title = None
        self.title_parts = []
        self.in_title = False
        self.anchor = None
        self.developers = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'meta' and a.get('property') == 'og:title':
            self.og_title = a.get('content')
        if tag == 'title': self.in_title = True
        if tag == 'a':
            href = a.get('href', '')
            if re.search(r'(?:^|https://play\.google\.com)/store/apps/(?:dev|developer)\?id=', href):
                self.anchor = []
    def handle_data(self, data):
        if self.in_title: self.title_parts.append(data)
        if self.anchor is not None: self.anchor.append(data)
    def handle_endtag(self, tag):
        if tag == 'title': self.in_title = False
        if tag == 'a' and self.anchor is not None:
            value = ' '.join(''.join(self.anchor).split())
            if value: self.developers.append(value)
            self.anchor = None

def get(url):
    last = None
    for attempt in range(2):
        try:
            response = requests.get(url, headers={'User-Agent': UA}, timeout=(8, 18), allow_redirects=True)
            if response.status_code < 400: return response, None
            last = 'HTTP ' + str(response.status_code)
        except requests.RequestException as exc:
            last = type(exc).__name__ + ': ' + str(exc)
        if attempt == 0: time.sleep(0.35)
    return None, last

def verify(candidate):
    category, package, website = candidate
    url = 'https://play.google.com/store/apps/details?id=' + package
    response, error = get(url + '&hl=en&gl=US')
    checked = datetime.datetime.now(datetime.timezone.utc).isoformat()
    if response is None or response.status_code != 200:
        return None, {'package_id': package, 'category': category, 'reason': error or 'HTTP ' + str(response.status_code)}, None
    parser = ListingParser()
    parser.feed(response.text)
    title = parser.og_title or ''.join(parser.title_parts)
    title = re.sub(r'\s*-\s*Apps on Google Play\s*$', '', title).strip()
    if not title or title in ('Google Play', 'Not Found'):
        return None, {'package_id': package, 'category': category, 'reason': 'No reliable app title'}, None
    developers = list(dict.fromkeys(parser.developers))
    publisher = developers[0] if len(developers) == 1 else None
    site_response, site_error = get(website)
    site_failure = None if site_response is not None else {'package_id': package, 'website_url': website, 'reason': site_error}
    return {'name': title, 'publisher': publisher, 'category': category, 'play_store_url': url, 'website_url': website if site_response is not None else None, 'package_id': package, 'listing_available': True, 'last_verified_at': checked, 'client_authorized': False, 'testing_instructions': None}, None, site_failure

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--output', type=Path, default=Path(__file__).resolve().with_name('apps.json'))
    ap.add_argument('--report', type=Path)
    args = ap.parse_args()
    candidates = []
    seen = set()
    for category, rows in CANDIDATES.items():
        for row in rows.strip().splitlines():
            package, website = row.strip().split('|')
            if package in seen: raise ValueError('Duplicate candidate: ' + package)
            seen.add(package)
            candidates.append((category, package, website))
    apps, failures, site_failures = [], [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for i, (app, failure, site_failure) in enumerate(pool.map(verify, candidates), 1):
            if app: apps.append(app)
            if failure: failures.append(failure)
            if site_failure: site_failures.append(site_failure)
            if i % 25 == 0: print(f'Processed {i}/{len(candidates)}; retained {len(apps)}', flush=True)
    apps.sort(key=lambda app: (app['category'], app['name'].casefold()))
    assert len({app['package_id'] for app in apps}) == len(apps)
    if len(apps) < 180: raise RuntimeError(f'Only {len(apps)} verified apps; minimum is 180')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(apps, indent=2, ensure_ascii=False) + '\n')
    report = {'candidates': len(candidates), 'verified': len(apps), 'per_category': dict(sorted(Counter(a['category'] for a in apps).items())), 'listing_failures': failures, 'website_failures': site_failures, 'null_publishers': sum(a['publisher'] is None for a in apps), 'samples': apps[:2]}
    if args.report: args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps(report, indent=2, ensure_ascii=False))

if __name__ == '__main__': main()
