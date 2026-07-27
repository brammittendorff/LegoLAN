/*
 * LEGOLAN 2026 - Stripclub Editie
 *
 * Dit bestand is de jaarlijkse "skin": alle eventgegevens en copy staan hier,
 * in het Nederlands en Engels. Volgend jaar: kopieer deze map naar bv.
 * 2027-<thema>/, pas alles aan en wijzig de import in src/theme/index.ts.
 * Kleuren/fonts staan in src/index.css (@theme-blok).
 */

export type ThemeCopy = {
  edition: string
  tagline: string
  date: string
  location: string
  address: string
  buildup: string
  hero: { sub: string; ctaPrimary: string; ctaSecondary: string }
  marqueeWords: readonly string[]
  program: readonly { title: string; text: string }[]
  recap: { title: string; text: string }
  smallPrint: string
}

const nl: ThemeCopy = {
  edition: 'Stripclub Editie',
  tagline: 'HET HEETSTE LAN-FEEST VAN NEDERLAND',
  date: '9 t/m 11 oktober 2026',
  location: 'Topweg 31, Hengelo',
  address: 'Topweg 31, 7559 PG Hengelo',
  buildup:
    'Opbouw op donderdag 8 oktober - kom je meehelpen sjouwen en kabels leggen? Dan ben je die dag gratis binnen en onze held.',

  hero: {
    sub: 'Eén weekend. Eén zaal. Games, vrienden en heel veel gezelligheid.',
    ctaPrimary: 'Koop je ticket',
    ctaSecondary: 'Wat is dit?',
  },

  marqueeWords: [
    'GAMERS GAMERS GAMERS',
    'LIVE ★ TOERNOOIEN',
    'NO COVER CHARGE (WEL TICKET)',
    'VIP ROOM = CONSOLEHOEK',
    'DE PAAL IS VOOR DE NETWERKKABELS',
  ],

  // Het programma (onder voorbehoud - de ideeenlijst van de organisatie)
  program: [
    {
      title: 'Licht, audio & lasers',
      text: 'Chris bouwt de zaal om tot club. Epilepsie-waarschuwing volgt.',
    },
    {
      title: 'Offline & online compo',
      text: 'Toernooien op de main stage, voor eer, prijzen en bragging rights.',
    },
    {
      title: 'Workshop shibari-knopen',
      text: 'Eindelijk kabelmanagement-skills waar je wat aan hebt.',
    },
    {
      title: 'Twister - deluxe editie',
      text: 'Met glijmiddel. Condooms aanwezig. Vragen stellen mag niet.',
    },
    {
      title: 'Oud-Hollandse spelen',
      text: 'Koekhappen is voor kinderfeestjes. Wij spelen de ondergoed-editie.',
    },
    {
      title: 'Genital Jousting-toernooi',
      text: 'Ja, dat is echt een game. Nee, we leggen niet uit hoe we erop kwamen.',
    },
    {
      title: 'Spotify Jam & de bar',
      text: 'Eén gedeelde queue, shotjes met zeer twijfelachtige namen. Chaos gegarandeerd.',
    },
  ],

  recap: {
    title: 'Vorige editie: MURICA F*CK YEAH',
    text:
      'LEGOLAN 2025 was drie dagen yeehaw: toernooien, twijfelachtige cowboyhoeden en te weinig slaap. ' +
      'Dit jaar ruilen we de saloon in voor iets... intiemers.',
  },

  smallPrint:
    'LEGOLAN is niet gelieerd aan de LEGO Group. Of aan een echte stripclub. Echt niet.',
}

const en: ThemeCopy = {
  edition: 'Strip Club Edition',
  tagline: 'THE HOTTEST LAN PARTY IN THE NETHERLANDS',
  date: 'October 9-11, 2026',
  location: 'Topweg 31, Hengelo',
  address: 'Topweg 31, 7559 PG Hengelo, the Netherlands',
  buildup:
    'Setup day is Thursday October 8 - come help us haul gear and run cables and that day is free for you, hero status included.',

  hero: {
    sub: 'One weekend. One hall. Games, friends and a whole lot of good times.',
    ctaPrimary: 'Get your ticket',
    ctaSecondary: 'What is this?',
  },

  marqueeWords: [
    'GAMERS GAMERS GAMERS',
    'LIVE ★ TOURNAMENTS',
    'NO COVER CHARGE (TICKET REQUIRED)',
    'VIP ROOM = CONSOLE CORNER',
    'THE POLE IS FOR THE NETWORK CABLES',
  ],

  program: [
    {
      title: 'Lights, audio & lasers',
      text: 'Chris turns the hall into a club. Epilepsy warning to follow.',
    },
    {
      title: 'Offline & online compo',
      text: 'Tournaments on the main stage, for honour, prizes and bragging rights.',
    },
    {
      title: 'Shibari knots workshop',
      text: 'Finally, cable management skills you can actually use.',
    },
    {
      title: 'Twister - deluxe edition',
      text: 'With lube. Condoms provided. No questions allowed.',
    },
    {
      title: 'Old Dutch games',
      text: 'Regular fairground games are for kids parties. We play the underwear edition.',
    },
    {
      title: 'Genital Jousting tournament',
      text: 'Yes, that is a real game. No, we will not explain how we found it.',
    },
    {
      title: 'Spotify Jam & the bar',
      text: 'One shared queue, shots with highly questionable names. Chaos guaranteed.',
    },
  ],

  recap: {
    title: 'Last edition: MURICA F*CK YEAH',
    text:
      'LEGOLAN 2025 was three days of yeehaw: tournaments, questionable cowboy hats and not enough sleep. ' +
      'This year we are trading the saloon for something... more intimate.',
  },

  smallPrint:
    'LEGOLAN is not affiliated with the LEGO Group. Or with an actual strip club. Really not.',
}

export const THEME = {
  year: 2026,
  name: 'LEGOLAN',
  scriptWord: 'stripclub', // het neon-krulwoord onder het logo
  socials: {
    facebook: 'https://www.facebook.com/legolannl',
    x: 'https://x.com/legolannl',
  },
  copy: { nl, en },
} as const

export type Theme = typeof THEME
