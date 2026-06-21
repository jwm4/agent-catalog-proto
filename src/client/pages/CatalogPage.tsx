import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardBody,
  Content,
  Gallery,
  Label,
  LabelGroup,
  PageSection,
  Pagination,
  SearchInput,
  Tab,
  Tabs,
  TabTitleText,
} from '@patternfly/react-core';
import { harnesses } from '@shared/harnesses';

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
        <Content component="h1">Agents</Content>
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

        <Gallery
          hasGutter
          minWidths={{ default: '360px' }}
          style={{ marginTop: '16px' }}
        >
          {paginated.map((harness) => (
            <Card key={harness.id} isFullHeight>
              <CardBody>
                <div style={{ marginBottom: '0.75rem' }}>
                  <Link
                    to={`/agents/${harness.id}`}
                    style={{
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      textDecoration: 'underline',
                    }}
                  >
                    {harness.name}
                  </Link>
                </div>
                <p style={{ margin: 0 }}>{harness.description}</p>
                <LabelGroup style={{ marginTop: '1rem' }}>
                  {harness.tags.map((tag, i) => (
                    <Label
                      key={tag}
                      variant="outline"
                      color={i === 0 ? 'blue' : undefined}
                    >
                      {tag}
                    </Label>
                  ))}
                </LabelGroup>
              </CardBody>
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
