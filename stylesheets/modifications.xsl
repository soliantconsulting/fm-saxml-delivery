<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

	<!-- Specify no XML declaration in the output -->
	<xsl:output method="text" omit-xml-declaration="yes" />

	<!-- Template to match the root of the XML document -->
	<xsl:template match="/">
		<!-- Add header row -->
		<xsl:text>db,saxmlVer,catalog,item,id,annotation,element,modCount,user,account,ts&#10;</xsl:text>

		<!-- Get db name without file extension -->
		<xsl:variable name="db"
			select="substring(FMSaveAsXML/@File, 1, string-length(FMSaveAsXML/@File) - 6)" />
		<xsl:variable name="saxmlVer" select="FMSaveAsXML/@version" />

		<!-- BaseDirectoryCatalog/BaseDirectory -->
		<xsl:for-each select="FMSaveAsXML/Structure/AddAction/BaseDirectoryCatalog/BaseDirectory">
			<xsl:call-template name="process-catalog-entry">
				<xsl:with-param name="db" select="$db" />
				<xsl:with-param name="saxmlVer" select="$saxmlVer" />
			</xsl:call-template>
		</xsl:for-each>

		<!-- FileAccessCatalog/ObjectList/Authorization -->
		<xsl:for-each
			select="FMSaveAsXML/Structure/AddAction/FileAccessCatalog/ObjectList/Authorization">
			<xsl:call-template name="process-catalog-entry">
				<xsl:with-param name="db" select="$db" />
				<xsl:with-param name="saxmlVer" select="$saxmlVer" />
				<xsl:with-param name="parent-name" select="local-name(../..)" />
				<xsl:with-param name="name-attr" select="Display" />
				<xsl:with-param name="modifier" select="@type" />
			</xsl:call-template>
		</xsl:for-each>

		<!-- ExternalDataSourceCatalog/ExternalDataSource -->
		<xsl:for-each
			select="FMSaveAsXML/Structure/AddAction/ExternalDataSourceCatalog/ExternalDataSource">
			<xsl:call-template name="process-catalog-entry">
				<xsl:with-param name="db" select="$db" />
				<xsl:with-param name="saxmlVer" select="$saxmlVer" />
			</xsl:call-template>
		</xsl:for-each>

		<!-- BaseTableCatalog/BaseTable -->
		<xsl:for-each select="FMSaveAsXML/Structure/AddAction/BaseTableCatalog/BaseTable">
			<xsl:call-template name="process-catalog-entry">
				<xsl:with-param name="db" select="$db" />
				<xsl:with-param name="saxmlVer" select="$saxmlVer" />
			</xsl:call-template>
		</xsl:for-each>

		<!-- TableOccurrenceCatalog/TableOccurrence -->
		<xsl:for-each
			select="FMSaveAsXML/Structure/AddAction/TableOccurrenceCatalog/TableOccurrence">
			<xsl:call-template name="process-catalog-entry">
				<xsl:with-param name="db" select="$db" />
				<xsl:with-param name="saxmlVer" select="$saxmlVer" />
				<xsl:with-param name="modifier"
					select="BaseTableSourceReference/BaseTableReference/@name" />
			</xsl:call-template>
		</xsl:for-each>

		<!-- CustomFunctionsCatalog/ObjectList/CustomFunction -->
		<xsl:for-each
			select="FMSaveAsXML/Structure/AddAction/CustomFunctionsCatalog/ObjectList/CustomFunction">
			<xsl:call-template name="process-catalog-entry">
				<xsl:with-param name="db" select="$db" />
				<xsl:with-param name="saxmlVer" select="$saxmlVer" />
				<xsl:with-param name="parent-name" select="local-name(../..)" />
				<xsl:with-param name="modifier">
					<xsl:choose>
						<xsl:when test="@isFolder = 'True'">FolderStart</xsl:when>
						<xsl:when test="@isFolder = 'Marker'">FolderEnd</xsl:when>
						<xsl:otherwise></xsl:otherwise>
					</xsl:choose>
				</xsl:with-param>
			</xsl:call-template>
		</xsl:for-each>

		<!-- ValueListCatalog/ValueList -->
		<xsl:for-each select="FMSaveAsXML/Structure/AddAction/ValueListCatalog/ValueList">
			<xsl:call-template name="process-catalog-entry">
				<xsl:with-param name="db" select="$db" />
				<xsl:with-param name="saxmlVer" select="$saxmlVer" />
				<xsl:with-param name="modifier" select="Source/@value" />
			</xsl:call-template>
		</xsl:for-each>

		<!-- FieldsForTables/ObjectList/FieldCatalog -->
		<xsl:for-each
			select="FMSaveAsXML/Structure/AddAction/FieldsForTables/FieldCatalog/ObjectList/Field">
			<xsl:call-template name="process-catalog-entry">
				<xsl:with-param name="db" select="$db" />
				<xsl:with-param name="saxmlVer" select="$saxmlVer" />
				<xsl:with-param name="parent-name" select="local-name(../../..)" />
				<xsl:with-param name="modifier" select="../../BaseTableReference/@name" />
			</xsl:call-template>
		</xsl:for-each>

		<!-- Note: modification info is not captured for OptionsForValueLists -->

		<!-- RelationshipCatalog/Relationship -->
		<xsl:for-each select="FMSaveAsXML/Structure/AddAction/RelationshipCatalog/Relationship">
			<xsl:call-template name="process-catalog-entry">
				<xsl:with-param name="db" select="$db" />
				<xsl:with-param name="saxmlVer" select="$saxmlVer" />
				<xsl:with-param name="name-attr" select="LeftTable/TableOccurrenceReference/@name" />
				<xsl:with-param name="modifier" select="RightTable/TableOccurrenceReference/@name" />
			</xsl:call-template>
		</xsl:for-each>

		<!-- Note: modification info is not captured for CalcsForCustomFunctions -->

		<!-- CustomMenuCatalog/CustomMenu -->
		<xsl:for-each select="FMSaveAsXML/Structure/AddAction/CustomMenuCatalog/CustomMenu">
			<xsl:call-template name="process-catalog-entry">
				<xsl:with-param name="db" select="$db" />
				<xsl:with-param name="saxmlVer" select="$saxmlVer" />
				<xsl:with-param name="modifier" select="Base/@name" />
			</xsl:call-template>
		</xsl:for-each>

		<!-- CustomMenuSetCatalog/ObjectList/CustomMenuSet -->
		<xsl:for-each
			select="FMSaveAsXML/Structure/AddAction/CustomMenuSetCatalog/ObjectList/CustomMenuSet">
			<xsl:variable name="modifier">
				<xsl:for-each select="CustomMenuList/CustomMenuReference">
					<xsl:if test="position() &gt; 1">
						<xsl:text>;</xsl:text> <!-- Add separator if not the first item -->
					</xsl:if>
					<xsl:value-of select="@name" />
				</xsl:for-each>
			</xsl:variable>
			<xsl:call-template name="process-catalog-entry">
				<xsl:with-param name="db" select="$db" />
				<xsl:with-param name="saxmlVer" select="$saxmlVer" />
				<xsl:with-param name="modifier" select="$modifier" />
			</xsl:call-template>
		</xsl:for-each>

		<!-- ScriptCatalog/Script -->
		<xsl:for-each select="FMSaveAsXML/Structure/AddAction/ScriptCatalog/Script">
			<xsl:call-template name="process-catalog-entry">
				<xsl:with-param name="db" select="$db" />
				<xsl:with-param name="saxmlVer" select="$saxmlVer" />
				<xsl:with-param name="modifier">
					<xsl:choose>
						<xsl:when test="@isFolder = 'True'">FolderStart</xsl:when>
						<xsl:when test="@isFolder = 'Marker'">FolderEnd</xsl:when>
						<xsl:otherwise></xsl:otherwise>
					</xsl:choose>
				</xsl:with-param>
			</xsl:call-template>
		</xsl:for-each>

		<!-- ThemeCatalog/Theme -->
		<xsl:for-each select="FMSaveAsXML/Structure/AddAction/ThemeCatalog/Theme">
			<xsl:call-template name="process-catalog-entry">
				<xsl:with-param name="db" select="$db" />
				<xsl:with-param name="saxmlVer" select="$saxmlVer" />
				<xsl:with-param name="name-attr" select="@Display" />
			</xsl:call-template>
		</xsl:for-each>

		<!-- LayoutCatalog/Layout -->
		<xsl:for-each select="FMSaveAsXML/Structure/AddAction/LayoutCatalog/Layout">
			<xsl:call-template name="process-catalog-entry">
				<xsl:with-param name="db" select="$db" />
				<xsl:with-param name="saxmlVer" select="$saxmlVer" />
			</xsl:call-template>
		</xsl:for-each>

		<!-- LibraryCatalog/BinaryData -->
		<xsl:for-each select="FMSaveAsXML/Structure/AddAction/LibraryCatalog/BinaryData">
			<xsl:variable name="modifier">
				<xsl:for-each select="StreamList/Stream">
					<xsl:if test="position() &gt; 1">
						<xsl:text>;</xsl:text> <!-- Add separator if not the first item -->
					</xsl:if>
					<xsl:value-of select="concat(normalize-space(@name), '(', @type, ')')" /><!--
					normalize-space trims spaces (but not tabs or newlines) -->
				</xsl:for-each>
			</xsl:variable>
			<xsl:call-template name="process-catalog-entry">
				<xsl:with-param name="db" select="$db" />
				<xsl:with-param name="saxmlVer" select="$saxmlVer" />
				<xsl:with-param name="modifier" select="$modifier" />
				<xsl:with-param name="name-attr" select="LibraryReference/@key" />
			</xsl:call-template>
		</xsl:for-each>

		<!-- PrivilegeSetsCatalog/ObjectList/PrivilegeSet -->
		<xsl:for-each
			select="FMSaveAsXML/Structure/AddAction/PrivilegeSetsCatalog/ObjectList/PrivilegeSet">
			<xsl:call-template name="process-catalog-entry">
				<xsl:with-param name="db" select="$db" />
				<xsl:with-param name="saxmlVer" select="$saxmlVer" />
				<xsl:with-param name="parent-name" select="local-name(../..)" />
			</xsl:call-template>
		</xsl:for-each>

		<!-- ExtendedPrivilegesCatalog/ObjectList/ExtendedPrivilege -->
		<xsl:for-each
			select="FMSaveAsXML/Structure/AddAction/ExtendedPrivilegesCatalog/ObjectList/ExtendedPrivilege">
			<xsl:call-template name="process-catalog-entry">
				<xsl:with-param name="db" select="$db" />
				<xsl:with-param name="saxmlVer" select="$saxmlVer" />
				<xsl:with-param name="parent-name" select="local-name(../..)" />
			</xsl:call-template>
		</xsl:for-each>

		<!-- AccountsCatalog/ObjectList/Account -->
		<xsl:for-each select="FMSaveAsXML/Structure/AddAction/AccountsCatalog/ObjectList/Account">
			<xsl:variable name="element">
				<xsl:choose>
					<xsl:when
						test="$saxmlVer = '2.1.0.0' or $saxmlVer = '2.2.0.0' or $saxmlVer = '2.2.1.0' or $saxmlVer = '2.2.2.0'">
						<xsl:value-of select="Authentication/AccountName/INSECURE_TEXT" />
					</xsl:when>
					<xsl:otherwise>
						<!-- 2.0.0.0 and 2.2.3.0 -->
						<xsl:value-of select="Authentication/AccountName" />
					</xsl:otherwise>
				</xsl:choose>
			</xsl:variable>
			<xsl:call-template name="process-catalog-entry">
				<xsl:with-param name="db" select="$db" />
				<xsl:with-param name="saxmlVer" select="$saxmlVer" />
				<xsl:with-param name="parent-name" select="local-name(../..)" />
				<xsl:with-param name="name-attr" select="$element" />
				<xsl:with-param name="modifier" select="@type" />
			</xsl:call-template>
		</xsl:for-each>

		<!-- Note: modification info is not captured for StepsForScripts -->

	</xsl:template>

	<!-- Template for catalog entry processing with defaults -->
	<xsl:template name="process-catalog-entry">
		<xsl:param name="db" />
		<xsl:param name="saxmlVer" />
		<xsl:param name="parent-name" select="local-name(..)" />
		<xsl:param name="current-name" select="name()" />
		<xsl:param name="id-attr" select="@id" />
		<xsl:param name="modifier" select="''" />
		<xsl:param name="name-attr" select="@name" />
		<xsl:param name="mod-count" select="UUID/@modifications" />
		<xsl:param name="user-name" select="UUID/@userName" />
		<xsl:param name="account-name" select="UUID/@accountName" />
		<xsl:param name="timestamp" select="UUID/@timestamp" />
		<xsl:param name="timestamp2"
			select="concat(substring($timestamp, 6, 2), '/', substring($timestamp, 9, 2), '/', substring($timestamp, 1, 4), ' ', substring($timestamp, 12, 5))" />

		<!-- Create output line with dynamic data -->
		<xsl:call-template name="csv-escape">
			<xsl:with-param name="text" select="$db" />
		</xsl:call-template>
		<xsl:text>,</xsl:text>
		<xsl:call-template name="csv-escape">
			<xsl:with-param name="text" select="$saxmlVer" />
		</xsl:call-template>
		<xsl:text>,</xsl:text>
		<xsl:call-template name="csv-escape">
			<xsl:with-param name="text" select="$parent-name" />
		</xsl:call-template>
		<xsl:text>,</xsl:text>
		<xsl:call-template name="csv-escape">
			<xsl:with-param name="text" select="$current-name" />
		</xsl:call-template>
		<xsl:text>,</xsl:text>
		<xsl:call-template name="csv-escape">
			<xsl:with-param name="text" select="$id-attr" />
		</xsl:call-template>
		<xsl:text>,</xsl:text>
		<xsl:call-template name="csv-escape">
			<xsl:with-param name="text" select="$modifier" />
		</xsl:call-template>
		<xsl:text>,</xsl:text>
		<xsl:call-template name="csv-escape">
			<xsl:with-param name="text" select="$name-attr" />
		</xsl:call-template>
		<xsl:text>,</xsl:text>
		<xsl:call-template name="csv-escape">
			<xsl:with-param name="text" select="$mod-count" />
		</xsl:call-template>
		<xsl:text>,</xsl:text>
		<xsl:call-template name="csv-escape">
			<xsl:with-param name="text" select="$user-name" />
		</xsl:call-template>
		<xsl:text>,</xsl:text>
		<xsl:call-template name="csv-escape">
			<xsl:with-param name="text" select="$account-name" />
		</xsl:call-template>
		<xsl:text>,</xsl:text>
		<xsl:text>&#10;</xsl:text>
	</xsl:template>

	<!-- Template to escape CSV values -->
	<xsl:template name="csv-escape">
		<xsl:param name="text" />
		<xsl:choose>
			<xsl:when
				test="contains($text, ',') or contains($text, '&quot;') or contains($text, '&#10;') or contains($text, '&#13;')">
				<xsl:value-of
					select="concat('&quot;', translate($text, '&quot;', '&quot;&quot;'), '&quot;')" />
			</xsl:when>
			<xsl:otherwise>
				<xsl:value-of select="$text" />
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>

</xsl:stylesheet>