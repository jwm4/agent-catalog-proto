import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardBody,
  CardFooter,
  CardTitle,
  Content,
  Gallery,
  Label,
  PageSection,
  Pagination,
  SearchInput,
  Tab,
  Tabs,
  TabTitleText,
} from '@patternfly/react-core';
import { harnesses } from '@client/data/harnesses';

const PER_PAGE = 10;

export function CatalogPage() {
  const [searchChips, setSearchChips] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (searchChips.length === 0) return harnesses;
    return harnesses.filter((h) => {
      const text = `${h.name} ${h.description} ${h.tags.join(' ')}`.toLowerCase();
      return searchChips.every((chip) => text.includes(chip.toLowerCase()));
    });
  }, [searchChips]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return filtered.slice(start, start + PER_PAGE);
  }, [filtered, page]);

  const handleSearch = (_event: React.FormEvent, value: string) => {
    setCurrentInput(value);
  };

  const handleSearchEnter = () => {
    const trimmed = currentInput.trim();
    if (trimmed && !searchChips.includes(trimmed)) {
      setSearchChips([...searchChips, trimmed]);
      setCurrentInput('');
      setPage(1);
    }
  };

  const handleChipDelete = (chipToDelete: string) => {
    setSearchChips(searchChips.filter((c) => c !== chipToDelete));
    setPage(1);
  };

  const handleClearAll = () => {
    setSearchChips([]);
    setCurrentInput('');
    setPage(1);
  };

  return (
    <>
      <PageSection hasBodyWrapper={false}>
        <Content>
          <Content component="h1">Agents</Content>
        </Content>
      </PageSection>

      <PageSection hasBodyWrapper={false} padding={{ default: 'noPadding' }}>
        <Tabs activeKey="catalog" style={{ paddingLeft: '24px' }}>
          <Tab
            eventKey="catalog"
            title={<TabTitleText>Catalog</TabTitleText>}
          />
          <Tab
            eventKey="deployments"
            title={<TabTitleText>Deployments</TabTitleText>}
            isDisabled
          />
        </Tabs>
      </PageSection>

      <PageSection hasBodyWrapper={false}>
        <SearchInput
          placeholder="Search agents (press Enter to add)"
          value={currentInput}
          onChange={handleSearch}
          onKeyUp={(e) => {
            if (e.key === 'Enter') handleSearchEnter();
          }}
          onClear={() => handleClearAll()}
          style={{ maxWidth: '400px' }}
        />

        {searchChips.length > 0 && (
          <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
            {searchChips.map((chip) => (
              <Label
                key={chip}
                onClose={() => handleChipDelete(chip)}
                variant="outline"
              >
                {chip}
              </Label>
            ))}
          </div>
        )}

        <Content component="h2" style={{ marginTop: '24px' }}>
          Agent starter kits
        </Content>
        <Content component="p">
          Pre-built agent templates from the Red Hat agentic starter kits
          collection.
        </Content>

        <Gallery
          hasGutter
          minWidths={{ default: '300px' }}
          style={{ marginTop: '16px' }}
        >
          {paginated.map((harness) => (
            <Card key={harness.id} isCompact>
              <CardTitle>
                <Link to={`/agents/${harness.id}`}>{harness.name}</Link>
              </CardTitle>
              <CardBody>{harness.description}</CardBody>
              <CardFooter>
                {harness.tags.map((tag) => (
                  <Label key={tag} isCompact style={{ marginRight: '4px' }}>
                    {tag}
                  </Label>
                ))}
              </CardFooter>
            </Card>
          ))}
        </Gallery>

        {filtered.length > PER_PAGE && (
          <Pagination
            itemCount={filtered.length}
            perPage={PER_PAGE}
            page={page}
            onSetPage={(_e, newPage) => setPage(newPage)}
            variant="bottom"
            isCompact
            style={{ marginTop: '16px' }}
          />
        )}
      </PageSection>
    </>
  );
}
