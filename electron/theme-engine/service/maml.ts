export function normalizeActivityName(packageName: string, className: string) {
  const trimmed = className.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith(".")) return `${packageName}${trimmed}`;
  if (!trimmed.includes(".")) return `${packageName}.${trimmed}`;
  return trimmed;
}

export function parseCurrentActivity(dumpsys: string) {
  const patterns = [
    /mCurrentFocus=Window\{[^}]*\s+([a-zA-Z0-9_.]+)\/([^\s}]+)\s*[\s}]/m,
    /mFocusedApp=ActivityRecord\{[^}]*\s+([a-zA-Z0-9_.]+)\/([^\s}]+)\s*[\s}]/m,
    /topResumedActivity=.*?\s([a-zA-Z0-9_.]+)\/([^\s}]+)\s/m,
    /mResumedActivity=.*?\s([a-zA-Z0-9_.]+)\/([^\s}]+)\s/m
  ];
  for (const pattern of patterns) {
    const match = dumpsys.match(pattern);
    if (match?.[1]) {
      const packageName = match[1];
      return {
        packageName,
        className: normalizeActivityName(packageName, match[2] || "")
      };
    }
  }
  return null;
}

export function parseCurrentPackage(dumpsys: string) {
  return parseCurrentActivity(dumpsys)?.packageName || "";
}

export function convertXmlToMaml(xml: string) {
  const trimmed = xml.trim();
  if (!trimmed) return "";

  const escaped = trimmed
    .replace(/<\?xml[^>]*>/gi, "")
    .replace(/\r\n/g, "\n")
    .trim();

  if (/^\s*<(Lockscreen|MiWallpaper|Icon)\b/i.test(escaped)) {
    return escaped;
  }

  return [
    '<Lockscreen version="1" frameRate="30" screenWidth="1080">',
    "  <Var name=\"source_xml\"><![CDATA[",
    escaped,
    "  ]]></Var>",
    '  <Group name="converted_xml" visibility="1">',
    '    <Text x="0" y="0" color="#FFFFFFFF" size="36" text="Converted XML" />',
    "  </Group>",
    "</Lockscreen>"
  ].join("\n");
}

export function currentActivityToMaml(activity: { packageName: string; className: string }) {
  const escapedPackage = activity.packageName.replace(/'/g, "\\'");
  const escapedClass = activity.className.replace(/'/g, "\\'");
  return [
    `<Variable name="current_package" expression="'${escapedPackage}'" />`,
    `<Variable name="current_class" expression="'${escapedClass}'" />`,
    `<IntentCommand action="android.intent.action.MAIN" package="${activity.packageName}" class="${activity.className}" />`
  ].join("\n");
}

