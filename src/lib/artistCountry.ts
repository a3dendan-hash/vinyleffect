// Определение страны авторов / исполнителей по названию группы и описанию Discogs
export const resolveArtistCountry = (artistName?: string, notesOrProfile?: string | null): string => {
  if (!artistName) return 'Международный';
  const a = artistName.trim().toLowerCase();

  // 1. Отечественные исполнители (СССР / Россия)
  if (
    /кино|цой|наутилус|nautilus|бригадный подряд|бригадный|аквариум|бг|гребенщиков|ддт|шевчук|алиса|кинчев|сектор газа|гражданская оборона|летов|пикник|зоопарк|майк науменко|ария|браво|машина времени|макаревич|сплин|мумий тролль|земфира|би-2|король и шут|киш|кипелов|чиж|ночные снайперы|ленинград|шнуров|аукцыон|воскресение|звуки му|мамонов|ноль|федор чистяков|калинов мост|крематорий|чайф|пугачева|леонтьев|антонов|песняры|веселые ребята|самоцветы|земляне|добрынин|синяя птица|пламя|цветы|стас намин|хиль|кобзон|магамаев|магомаев|маркин|сикрет|секрет|любе|расторгуев|мифы|россияне|питерский рок/i.test(
      a
    )
  ) {
    return 'СССР / Россия';
  }

  // 2. Великобритания (UK)
  if (
    /depeche mode|beatles|pink floyd|queen|led zeppelin|rolling stones|black sabbath|david bowie|the cure|cure|iron maiden|deep purple|dire straits|oasis|radiohead|genesis|the police|police|sting|eric clapton|clapton|elton john|george michael|wham|duran duran|the clash|clash|sex pistols|joy division|new order|the smiths|smiths|morrissey|pet shop boys|blur|pulp|massive attack|portishead|kate bush|rod stewart|phil collins|yes|king crimson|jethro tull|motörhead|motorhead|judas priest|def leppard|tears for fears|simple minds|mark knopfler|fleetwood mac|the who|who|cream|elvis costello|the jam|jam|the specials|bauhaus|siouxsie|sisters of mercy|dead or alive|erasure|soft cell|spandau ballet|culture club|boy george|sade|seal|billy idol|adele|coldplay|gorillaz/i.test(
      a
    )
  ) {
    return 'Великобритания (UK)';
  }

  // 3. США (USA)
  if (
    /metallica|michael jackson|madonna|nirvana|elvis presley|elvis|bob dylan|the doors|doors|guns n' roses|gnr|red hot chili peppers|rhcp|eagles|stevie wonder|prince|bruce springsteen|aretha franklin|miles davis|john coltrane|louis armstrong|frank sinatra|billie holiday|ella fitzgerald|jimi hendrix|janis joplin|beach boys|the beach boys|ramones|the ramones|velvet underground|lou reed|talking heads|rem|r\.e\.m\.|pearl jam|soundgarden|alice in chains|bon jovi|aerosmith|kiss|van halen|tom petty|creedence|ccr|simon & garfunkel|paul simon|whitney houston|tina turner|marvin gaye|ray charles|bb king|b\.b\. king|muddy waters|chuck berry|iggy pop|the stooges|stooges|blondie|devo|pixies|sonic youth|green day|offspring|foofighters|foo fighters|red hot|system of a down|soad|rage against the machine|ratm|linkin park|eminem|tupac|2pac|notorious|dr\. dre|snoop dogg|run dmc|beastie boys|cypress hill|public enemy|pantera|megadeth|slayer|anthrax/i.test(
      a
    )
  ) {
    return 'США (USA)';
  }

  // 4. Германия (Germany)
  if (
    /kraftwerk|scorpions|rammstein|modern talking|boney m|bad boys blue|sandra|alphaville|can|neu!|faust|kreator|tangerine dream|doro|accept|helloween|blind guardian|michael schenker|bonfire|running wild|udo|gammaray|gamma ray|enigma|guano apes|tokio hotel|paul van dyk|atb|scooter/i.test(
      a
    )
  ) {
    return 'Германия (Germany)';
  }

  // 5. Франция (France)
  if (
    /space|didier marouani|marouani|daft punk|jean-michel jarre|jean michel jarre|jarre|air|edith piaf|piaf|serge gainsbourg|gainsbourg|justice|m83|phoenix|charles aznavour|aznavour|joe dassin|dassin|mireille mathieu|gesaffelstein|gipsy kings|laurent garnier|bob sinclar|david guetta|st germain/i.test(
      a
    )
  ) {
    return 'Франция (France)';
  }

  // 6. Италия (Italy)
  if (
    /celentano|adriano celentano|toto cutugno|cutugno|ricchi e poveri|pupo|al bano|romina power|albano|eros ramazzotti|ramazzotti|zucchero|laura pausini|pausini|moroder|giorgio moroder|ennio morricone|morricone|robert miles|matia bazar|savage|gazebo|ken laszlo|radiorama|den harrow|silver pozzoli|italo/i.test(
      a
    )
  ) {
    return 'Италия (Italy)';
  }

  // 7. Швеция (Sweden)
  if (
    /abba|roxette|ace of base|europe|the cardigans|cardigans|avicii|swedish house mafia|yngwie malmsteen|malmsteen|opeth|in flames|arch enemy|ghost|bathory|meshuggah|the hives|mando diao|army of lovers|e-type/i.test(
      a
    )
  ) {
    return 'Швеция (Sweden)';
  }

  // 8. Австралия (Australia)
  if (
    /ac\/dc|acdc|inxs|nick cave|the bad seeds|kylie minogue|minogue|midnight oil|men at work|tame impala|silverchair|bee gees|airbourne|wolfmother/i.test(
      a
    )
  ) {
    return 'Австралия (Australia)';
  }

  // 9. Ирландия (Ireland)
  if (
    /u2|the cranberries|cranberries|sinead o'connor|thin lizzy|enya|gary moore|the corrs|corrs|van morrison|pogues|the pogues|my bloody valentine|hozier|flogging molly/i.test(
      a
    )
  ) {
    return 'Ирландия (Ireland)';
  }

  // 10. Норвегия (Norway)
  if (/a-ha|aha|royksopp|dimmu borgir|mayhem|burzum|darkthrone|emperor|satyr|turbonegro/i.test(a)) {
    return 'Норвегия (Norway)';
  }

  // 11. Исландия (Iceland)
  if (/björk|bjork|sigur rós|sigur ros|of monsters and men|kaleo|sólstafir|solstafir/i.test(a)) {
    return 'Исландия (Iceland)';
  }

  // 12. Канада (Canada)
  if (/rush|neil young|leonard cohen|bryan adams|celine dion|the band|arcade fire|nickelback|sum 41|simple plan|alanis morissette|deadmau5|the weeknd|drake/i.test(a)) {
    return 'Канада (Canada)';
  }

  // 13. Ямайка (Jamaica)
  if (/bob marley|wailers|peter tosh|lee scratch perry|king tubby|dennis brown|burning spear|toots/i.test(a)) {
    return 'Ямайка (Jamaica)';
  }

  // 14. Нидерланды (Netherlands)
  if (/shocking blue|focus|golden earring|tiesto|tiësto|armin van buuren|martin garrix|within temptation|epica/i.test(a)) {
    return 'Нидерланды (Netherlands)';
  }

  // 15. Япония (Japan)
  if (/yellow magic orchestra|ymo|ryuichi sakamoto|sakamoto|casiopea|t-square|t square|tatsuro yamashita|mariya takeuchi|boris|mono|babymetal/i.test(a)) {
    return 'Япония (Japan)';
  }

  // 16. Анализ текста из заметок или профиля Discogs
  if (notesOrProfile) {
    const p = notesOrProfile.toLowerCase();
    if (/russian|soviet|born in.*(russia|ussr|moscow|leningrad|saint petersburg)|formed in.*(russia|ussr|moscow|leningrad|saint petersburg)/i.test(p)) {
      return 'СССР / Россия';
    }
    if (/english|british|born in.*(england|scotland|wales|uk|london)|formed in.*(england|london|uk)/i.test(p)) {
      return 'Великобритания (UK)';
    }
    if (/american|born in.*(usa|united states|new york|california)|formed in.*(usa|united states)/i.test(p)) {
      return 'США (USA)';
    }
    if (/german|born in.*germany|formed in.*(germany|berlin)/i.test(p)) {
      return 'Германия (Germany)';
    }
    if (/french|born in.*france|formed in.*(france|paris)/i.test(p)) {
      return 'Франция (France)';
    }
    if (/italian|born in.*italy|formed in.*italy/i.test(p)) {
      return 'Италия (Italy)';
    }
    if (/swedish|born in.*sweden|formed in.*sweden/i.test(p)) {
      return 'Швеция (Sweden)';
    }
    if (/japanese|born in.*japan|formed in.*japan/i.test(p)) {
      return 'Япония (Japan)';
    }
    if (/canadian|born in.*canada|formed in.*canada/i.test(p)) {
      return 'Канада (Canada)';
    }
    if (/australian|born in.*australia|formed in.*australia/i.test(p)) {
      return 'Австралия (Australia)';
    }
    if (/irish|born in.*ireland|formed in.*ireland/i.test(p)) {
      return 'Ирландия (Ireland)';
    }
    if (/jamaican|born in.*jamaica|formed in.*jamaica/i.test(p)) {
      return 'Ямайка (Jamaica)';
    }
    if (/dutch|born in.*netherlands|formed in.*netherlands/i.test(p)) {
      return 'Нидерланды (Netherlands)';
    }
  }

  return 'Импорт';
};
