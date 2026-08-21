class Character:
    def __init__(self, name, hp):
        self.name = name
        self.hp = hp


hero = Character('용사', 120)
mage = Character('마법사', 80)

print(hero.name, hero.hp)
print(mage.name, mage.hp)
